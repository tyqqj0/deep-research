// @/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useWorkspace } from '@/hooks/workspace/useWorkspace';

/**
 * A new, simplified homepage for testing the refactored architecture.
 * It uses our new domain-driven hooks to interact with the application state.
 */
export default function HomePage() {
  const {
    workspaces,
    activeWorkspace,
    isLoading,
    error,
    loadWorkspaces,
    activateWorkspace,
  } = useWorkspace();

  // Load workspaces when the component mounts
  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1>Research Navigator - Refactored</h1>
        <p>A test page to validate the new domain-driven architecture.</p>
      </header>

      <main>
        <h2>Workspaces</h2>
        {isLoading && <p>Loading workspaces...</p>}
        {error && <p style={{ color: 'red' }}>Error: {error}</p>}
        
        {!isLoading && !error && (
          <ul>
            {workspaces.map((ws) => (
              <li key={ws.id} style={{ marginBottom: '0.5rem' }}>
                {ws.name} ({ws.id})
                <button
                  onClick={() => activateWorkspace(ws.id)}
                  style={{ marginLeft: '1rem' }}
                  disabled={isLoading}
                >
                  Activate
                </button>
              </li>
            ))}
          </ul>
        )}

        <hr style={{ margin: '2rem 0' }} />

        <h2>Active Workspace Details</h2>
        {activeWorkspace ? (
          <div>
            <p><strong>ID:</strong> {activeWorkspace.id}</p>
            <p><strong>Name:</strong> {activeWorkspace.name}</p>
            <p><strong>Topic:</strong> {activeWorkspace.researchTopic}</p>
            <p><strong>MCTS Status:</strong> {activeWorkspace.mcts.status}</p>
            <p><strong>Tree ID:</strong> {activeWorkspace.treeId}</p>
          </div>
        ) : (
          <p>No active workspace.</p>
        )}
      </main>
    </div>
  );
}
