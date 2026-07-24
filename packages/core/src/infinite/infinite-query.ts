import type {
  InfiniteQueryOptions,
  InfiniteQueryState,
  InfiniteQueryPage,
} from '../types/infinite-query.types';
import { generateId } from '../utils/query.utils';

/**
 * Infinite Query
 *
 * Manages paginated data with forward and backward navigation.
 * Tracks page params, merged page data, and fetch states.
 *
 * All state is stored internally and exposed via immutable snapshots.
 *
 * @example
 * ```ts
 * const query = new InfiniteQuery({
 *   queryKey: ['posts'],
 *   queryFn: async ({ pageParam }) => {
 *     const res = await fetch(`/api/posts?cursor=${pageParam}`);
 *     return res.json();
 *   },
 *   initialPageParam: 0,
 *   getNextPageParam: (lastPage, allPages) => lastPage.nextCursor,
 * });
 *
 * await query.fetchNextPage();
 * console.log(query.state.pages); // [{ data: [...], pageParam: 0 }, ...]
 * ```
 */
export class InfiniteQuery<TData = unknown, TPageParam = unknown> {
  private readonly _id: string;
  private readonly _queryKey: readonly unknown[];
  private readonly _queryFn: InfiniteQueryOptions<TData, TPageParam>['queryFn'];
  private readonly _initialPageParam: TPageParam;
  private readonly _getNextPageParam: InfiniteQueryOptions<TData, TPageParam>['getNextPageParam'];
  private readonly _getPreviousPageParam?: InfiniteQueryOptions<TData, TPageParam>['getPreviousPageParam'];
  private readonly _maxPages: number;
  private readonly _listeners: Set<() => void>;

  private _pages: InfiniteQueryPage<TData>[];
  private _pageParams: unknown[];
  private _hasNextPage: boolean;
  private _hasPreviousPage: boolean;
  private _isFetchingNextPage: boolean;
  private _isFetchingPreviousPage: boolean;
  private _error: Error | null;
  private _destroyed: boolean;
  private _abortController: AbortController | null;

  constructor(options: InfiniteQueryOptions<TData, TPageParam>) {
    this._id = generateId();
    this._queryKey = options.queryKey;
    this._queryFn = options.queryFn;
    this._initialPageParam = (options.initialPageParam ?? 0) as TPageParam;
    this._getNextPageParam = options.getNextPageParam;
    this._getPreviousPageParam = options.getPreviousPageParam;
    this._maxPages = options.maxPages ?? Infinity;

    this._pages = [];
    this._pageParams = [];
    this._hasNextPage = true;
    this._hasPreviousPage = !!options.getPreviousPageParam;
    this._isFetchingNextPage = false;
    this._isFetchingPreviousPage = false;
    this._error = null;
    this._destroyed = false;
    this._abortController = null;
    this._listeners = new Set();
  }

  /**
   * Unique query identifier.
   */
  get id(): string {
    return this._id;
  }

  /**
   * The query key.
   */
  get queryKey(): readonly unknown[] {
    return this._queryKey;
  }

  /**
   * Current state snapshot.
   */
  get state(): InfiniteQueryState<TData> {
    return {
      pages: this._pages,
      pageParams: this._pageParams,
      hasNextPage: this._hasNextPage,
      hasPreviousPage: this._hasPreviousPage,
      isFetchingNextPage: this._isFetchingNextPage,
      isFetchingPreviousPage: this._isFetchingPreviousPage,
      error: this._error,
    };
  }

  /**
   * All page data flattened.
   */
  get data(): TData[] {
    return this._pages.map((p) => p.data);
  }

  /**
   * Whether more pages can be fetched forward.
   */
  get hasNextPage(): boolean {
    return this._hasNextPage;
  }

  /**
   * Whether more pages can be fetched backward.
   */
  get hasPreviousPage(): boolean {
    return this._hasPreviousPage;
  }

  /**
   * Whether next page fetch is in progress.
   */
  get isFetchingNextPage(): boolean {
    return this._isFetchingNextPage;
  }

  /**
   * Whether previous page fetch is in progress.
   */
  get isFetchingPreviousPage(): boolean {
    return this._isFetchingPreviousPage;
  }

  /**
   * Number of pages loaded.
   */
  get pageCount(): number {
    return this._pages.length;
  }

  /**
   * Whether the query has been destroyed.
   */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Subscribe to state changes.
   *
   * @param listener - Function called on state change
   * @returns Unsubscribe function
   */
  subscribe(listener: () => void): () => void {
    if (this._destroyed) {
      return () => {};
    }

    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Fetch the first page (initial load).
   * Resets all state and fetches page 0.
   */
  async fetch(): Promise<void> {
    this.assertNotDestroyed();

    this.cancel();
    this._abortController = new AbortController();

    this._pages = [];
    this._pageParams = [];
    this._error = null;
    this._isFetchingNextPage = false;
    this._isFetchingPreviousPage = false;
    this.notifyListeners();

    try {
      const pageParam = this._initialPageParam;
      const signal = this._abortController.signal;

      const data = await new Promise<TData>((resolve, reject) => {
        const onAbort = () => reject(new Error('InfiniteQuery cancelled'));
        signal.addEventListener('abort', onAbort, { once: true });
        this._queryFn({ pageParam, signal }).then(
          (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
          (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
        );
      });

      this._pages = [{ data, pageParam, pageIndex: 0 }];
      this._pageParams = [pageParam];

      this.updateHasNextPage();
      this.updateHasPreviousPage();

      this.notifyListeners();
    } catch (error) {
      if (this._abortController?.signal.aborted) return;

      this._error = error instanceof Error ? error : new Error(String(error));
      this.notifyListeners();
    } finally {
      this._abortController = null;
    }
  }

  /**
   * Fetch the next page.
   *
   * Uses getNextPageParam to determine the param for the next page.
   * If getNextPageParam returns undefined, no fetch occurs.
   *
   * @returns true if a fetch was initiated, false if no more pages
   */
  async fetchNextPage(): Promise<boolean> {
    this.assertNotDestroyed();

    if (this._isFetchingNextPage || !this._hasNextPage) {
      return false;
    }

    this._isFetchingNextPage = true;
    this._error = null;
    this.notifyListeners();

    const abortController = new AbortController();
    this._abortController = abortController;

    try {
      // Determine next page param
      const lastPageIndex = this._pages.length - 1;
      const lastPageData = lastPageIndex >= 0 ? this._pages[lastPageIndex]!.data : undefined;
      const lastPageParam = lastPageIndex >= 0 ? this._pageParams[lastPageIndex] : this._initialPageParam;

      const allData = this._pages.map((p) => p.data);
      const allParams = [...this._pageParams];

      const nextPageParam = this._getNextPageParam(
        lastPageData as TData,
        allData as TData[],
        lastPageParam,
        allParams,
      );

      if (nextPageParam === undefined) {
        this._hasNextPage = false;
        this._isFetchingNextPage = false;
        this.notifyListeners();
        return false;
      }

      const signal = abortController.signal;
      const data = await new Promise<TData>((resolve, reject) => {
        const onAbort = () => reject(new Error('InfiniteQuery cancelled'));
        signal.addEventListener('abort', onAbort, { once: true });
        this._queryFn({ pageParam: nextPageParam as TPageParam, signal }).then(
          (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
          (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
        );
      });

      // Add new page
      this._pages.push({
        data,
        pageParam: nextPageParam,
        pageIndex: this._pages.length,
      });
      this._pageParams.push(nextPageParam);

      // Enforce max pages
      if (this._pages.length > this._maxPages) {
        this._pages.shift();
        this._pageParams.shift();
        // Re-index pages
        this._pages.forEach((p, i) => {
          (p as { pageIndex: number }).pageIndex = i;
        });
      }

      this.updateHasNextPage();
      this._isFetchingNextPage = false;
      this.notifyListeners();

      return true;
    } catch (error) {
      if (abortController.signal.aborted) return false;

      this._error = error instanceof Error ? error : new Error(String(error));
      this._isFetchingNextPage = false;
      this.notifyListeners();

      return false;
    } finally {
      this._abortController = null;
    }
  }

  /**
   * Fetch the previous page.
   *
   * Uses getPreviousPageParam to determine the param for the previous page.
   * If getPreviousPageParam is not defined or returns undefined, no fetch occurs.
   *
   * @returns true if a fetch was initiated, false if no more pages
   */
  async fetchPreviousPage(): Promise<boolean> {
    this.assertNotDestroyed();

    if (this._isFetchingPreviousPage || !this._hasPreviousPage || !this._getPreviousPageParam) {
      return false;
    }

    this._isFetchingPreviousPage = true;
    this._error = null;
    this.notifyListeners();

    const abortController = new AbortController();
    this._abortController = abortController;

    try {
      // Determine previous page param
      const firstPageData = this._pages.length > 0 ? this._pages[0]!.data : undefined;
      const firstPageParam = this._pageParams.length > 0 ? this._pageParams[0] : this._initialPageParam;

      const allData = this._pages.map((p) => p.data);
      const allParams = [...this._pageParams];

      const prevPageParam = this._getPreviousPageParam(
        firstPageData as TData,
        allData as TData[],
        firstPageParam,
        allParams,
      );

      if (prevPageParam === undefined) {
        this._hasPreviousPage = false;
        this._isFetchingPreviousPage = false;
        this.notifyListeners();
        return false;
      }

      const signal = abortController.signal;
      const data = await new Promise<TData>((resolve, reject) => {
        const onAbort = () => reject(new Error('InfiniteQuery cancelled'));
        signal.addEventListener('abort', onAbort, { once: true });
        this._queryFn({ pageParam: prevPageParam as TPageParam, signal }).then(
          (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
          (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
        );
      });

      // Prepend new page
      this._pages.unshift({
        data,
        pageParam: prevPageParam,
        pageIndex: 0,
      });
      this._pageParams.unshift(prevPageParam);

      // Re-index pages
      this._pages.forEach((p, i) => {
        (p as { pageIndex: number }).pageIndex = i;
      });

      // Enforce max pages
      if (this._pages.length > this._maxPages) {
        this._pages.pop();
        this._pageParams.pop();
      }

      this.updateHasPreviousPage();
      this._isFetchingPreviousPage = false;
      this.notifyListeners();

      return true;
    } catch (error) {
      if (abortController.signal.aborted) return false;

      this._error = error instanceof Error ? error : new Error(String(error));
      this._isFetchingPreviousPage = false;
      this.notifyListeners();

      return false;
    } finally {
      this._abortController = null;
    }
  }

  /**
   * Cancel any in-flight fetches.
   */
  cancel(): void {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._isFetchingNextPage = false;
    this._isFetchingPreviousPage = false;
  }

  /**
   * Reset the query to its initial state.
   */
  reset(): void {
    this.assertNotDestroyed();

    this.cancel();
    this._pages = [];
    this._pageParams = [];
    this._hasNextPage = true;
    this._hasPreviousPage = !!this._getPreviousPageParam;
    this._error = null;
    this.notifyListeners();
  }

  /**
   * Destroy the query.
   * Cancels any in-flight fetches and clears all listeners.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this.cancel();
    this._listeners.clear();
  }

  private updateHasNextPage(): void {
    if (this._pages.length === 0) {
      this._hasNextPage = true;
      return;
    }

    const lastPageIndex = this._pages.length - 1;
    const lastPageData = this._pages[lastPageIndex]!.data;
    const lastPageParam = this._pageParams[lastPageIndex];

    const allData = this._pages.map((p) => p.data);
    const allParams = [...this._pageParams];

    const nextPageParam = this._getNextPageParam(
      lastPageData,
      allData,
      lastPageParam,
      allParams,
    );

    this._hasNextPage = nextPageParam !== undefined;
  }

  private updateHasPreviousPage(): void {
    if (!this._getPreviousPageParam) {
      this._hasPreviousPage = false;
      return;
    }

    if (this._pages.length === 0) {
      this._hasPreviousPage = true;
      return;
    }

    const firstPageData = this._pages[0]!.data;
    const firstPageParam = this._pageParams[0];

    const allData = this._pages.map((p) => p.data);
    const allParams = [...this._pageParams];

    const prevPageParam = this._getPreviousPageParam(
      firstPageData,
      allData,
      firstPageParam,
      allParams,
    );

    this._hasPreviousPage = prevPageParam !== undefined;
  }

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('InfiniteQuery has been destroyed');
    }
  }

  private notifyListeners(): void {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (_error) {
        // Listener errors must not crash the runtime.
      }
    }
  }
}
