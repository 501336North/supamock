import type { SchemaDefinition } from '../types.js';

export interface DependencyGraph {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
}

export interface TopologicalResult {
  sorted: string[];
  cycles: string[][];
}

/**
 * Builds a dependency graph from a schema's foreign key relationships.
 * Each edge represents "from depends on to" (from has an FK pointing to to).
 */
export function buildDependencyGraph(schema: SchemaDefinition): DependencyGraph {
  const nodes = schema.tables.map((table) => table.name);
  const edges: Array<{ from: string; to: string }> = [];

  for (const table of schema.tables) {
    for (const fk of table.foreignKeys) {
      edges.push({ from: table.name, to: fk.referencedTable });
    }
  }

  return { nodes, edges };
}

/**
 * Topologically sorts the dependency graph using Kahn's algorithm.
 * Returns tables in dependency order (parents first) and detects cycles.
 */
export function topologicalSort(graph: DependencyGraph): TopologicalResult {
  // Build adjacency list and in-degree map (excluding self-references for sort)
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  const selfReferencing = new Set<string>();

  for (const node of graph.nodes) {
    inDegree.set(node, 0);
    dependents.set(node, []);
  }

  for (const edge of graph.edges) {
    // Self-references are tracked separately and don't participate in Kahn's
    if (edge.from === edge.to) {
      selfReferencing.add(edge.from);
      continue;
    }

    // edge.from depends on edge.to, so edge.to -> edge.from in the DAG
    // In-degree: edge.from gains an incoming edge (it depends on edge.to)
    const current = inDegree.get(edge.from);
    if (current !== undefined) {
      inDegree.set(edge.from, current + 1);
    }

    // edge.to has edge.from as a dependent
    const deps = dependents.get(edge.to);
    if (deps) {
      deps.push(edge.from);
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  const sorted: string[] = [];
  let head = 0;

  while (head < queue.length) {
    const node = queue[head]!;
    head++;
    sorted.push(node);

    const deps = dependents.get(node);
    if (deps) {
      for (const dependent of deps) {
        const current = inDegree.get(dependent);
        if (current !== undefined) {
          const newDegree = current - 1;
          inDegree.set(dependent, newDegree);
          if (newDegree === 0) {
            queue.push(dependent);
          }
        }
      }
    }
  }

  const cycles: string[][] = [];
  const sortedSet = new Set(sorted);
  const remaining = graph.nodes.filter((n) => !sortedSet.has(n));

  if (remaining.length > 0) {
    cycles.push(remaining);
  }

  // Self-referencing tables are also cycles
  for (const node of selfReferencing) {
    // Only add if not already part of a cycle
    const alreadyInCycle = cycles.some((cycle) => cycle.includes(node));
    if (!alreadyInCycle) {
      cycles.push([node]);
    }
  }

  return { sorted, cycles };
}
