import type { TableMetadata, SortResult, BrokenEdge } from './types.js';

interface Edge {
  from: string;
  to: string;
  column: string;
  isNullable: boolean;
}

function buildEdges(tables: TableMetadata[]): Edge[] {
  const tableNames = new Set(tables.map((t) => t.name));
  const edges: Edge[] = [];

  for (const table of tables) {
    for (const col of table.columns) {
      if (col.foreignKey && tableNames.has(col.foreignKey.referencedTable)) {
        edges.push({
          from: table.name,
          to: col.foreignKey.referencedTable,
          column: col.name,
          isNullable: col.isNullable,
        });
      }
    }
  }

  return edges;
}

function kahns(
  tableNames: string[],
  edges: Edge[],
): { order: string[]; remaining: Set<string> } {
  const interEdges = edges.filter((e) => e.from !== e.to);

  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const name of tableNames) {
    inDegree.set(name, 0);
    adjacency.set(name, []);
  }

  for (const edge of interEdges) {
    inDegree.set(edge.from, (inDegree.get(edge.from) ?? 0) + 1);
    adjacency.get(edge.to)!.push(edge.from);
  }

  const queue: string[] = [];
  for (const [name, deg] of inDegree) {
    if (deg === 0) {
      queue.push(name);
    }
  }
  queue.sort();

  const order: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);

    const newlyReady: string[] = [];
    for (const neighbor of adjacency.get(node) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        newlyReady.push(neighbor);
      }
    }
    if (newlyReady.length > 0) {
      newlyReady.sort();
      for (const name of newlyReady) {
        const insertIdx = queue.findIndex((q) => q > name);
        if (insertIdx === -1) {
          queue.push(name);
        } else {
          queue.splice(insertIdx, 0, name);
        }
      }
    }
  }

  const ordered = new Set(order);
  const remaining = new Set(tableNames.filter((name) => !ordered.has(name)));

  return { order, remaining };
}

export function topologicalSort(tables: TableMetadata[]): SortResult {
  const tableNames = tables.map((t) => t.name);
  let edges = buildEdges(tables);
  const brokenEdges: BrokenEdge[] = [];

  let result = kahns(tableNames, edges);

  while (result.remaining.size > 0) {
    const cycleEdges = edges.filter(
      (e) =>
        e.from !== e.to &&
        result.remaining.has(e.from) &&
        result.remaining.has(e.to),
    );

    const edgeToBreak = cycleEdges.find((e) => e.isNullable) ?? cycleEdges[0];
    if (!edgeToBreak) break;

    brokenEdges.push({
      fromTable: edgeToBreak.from,
      toTable: edgeToBreak.to,
      column: edgeToBreak.column,
    });

    edges = edges.filter(
      (e) =>
        !(
          e.from === edgeToBreak.from &&
          e.to === edgeToBreak.to &&
          e.column === edgeToBreak.column
        ),
    );

    result = kahns(tableNames, edges);
  }

  return { order: result.order, brokenEdges };
}
