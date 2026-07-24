/**
 * Basic React Example
 *
 * Demonstrates SoulCache with React DevTools integration.
 *
 * Usage:
 *   npm run dev
 *   Open http://localhost:3000
 *   Click the SoulCache button in the bottom-right corner
 */

import { QueryClient } from '@soulcache/core';
import { SoulCacheDevToolsPanel } from '@soulcache/devtools';
import { useSoulCacheDevTools } from '@soulcache/devtools';

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    staleTime: 30000, // 30 seconds
    gcTime: 300000,   // 5 minutes
  },
});

// Example: Basic usage with DevTools
function App() {
  return (
    <div>
      <h1>SoulCache + DevTools Example</h1>
      <UserProfile userId={1} />
      <TodoList />
      <DevTools />
    </div>
  );
}

// Example: User profile with query caching
function UserProfile({ userId }: { userId: number }) {
  // In a real app, you'd use useQuery from @soulcache/react
  // This is a simplified example
  const user = { id: userId, name: 'Alice', email: 'alice@example.com' };

  return (
    <div style={{ padding: '16px', border: '1px solid #ccc', borderRadius: '8px', margin: '8px' }}>
      <h2>User Profile</h2>
      <p>Name: {user.name}</p>
      <p>Email: {user.email}</p>
    </div>
  );
}

// Example: Todo list with mutation
function TodoList() {
  const todos = [
    { id: 1, text: 'Learn SoulCache', completed: false },
    { id: 2, text: 'Build awesome app', completed: false },
    { id: 3, text: 'Ship to production', completed: true },
  ];

  return (
    <div style={{ padding: '16px', border: '1px solid #ccc', borderRadius: '8px', margin: '8px' }}>
      <h2>Todo List</h2>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id} style={{ textDecoration: todo.completed ? 'line-through' : 'none' }}>
            {todo.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Example: DevTools integration
function DevTools() {
  const devtools = useSoulCacheDevTools({
    client: queryClient,
    enabled: true,
  });

  return <SoulCacheDevToolsPanel devtools={devtools} defaultOpen={false} />;
}

export default App;

// Example: Direct usage of devtools-core (without React)
export function exampleDirectUsage() {
  const { createInspector, createTimeline, createDiagnostics, createTimelineEvent } = require('@soulcache/devtools-core');
  const inspector = createInspector();
  const timeline = createTimeline();
  const diagnostics = createDiagnostics();

  // Capture a snapshot
  const snapshot = inspector.inspectRuntime(queryClient);
  console.log('Cache size:', snapshot.cacheStats.size);

  // Record events
  const event = createTimelineEvent(
    'query.created',
    'example',
    { queryId: 'user-1' },
  );
  timeline.record(event);

  // Check health
  const cacheStats = inspector.inspectCacheStats(queryClient.getCache());
  const schedulerMetrics = inspector.inspectScheduler(queryClient.getScheduler());
  const healthReport = diagnostics.checkHealth(cacheStats, schedulerMetrics);
  console.log('Health:', healthReport.status);
}
