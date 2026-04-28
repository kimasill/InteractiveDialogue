/**
 * Narrative Graph Framework — canonical data model.
 *
 * Design:
 *   - CSV is an export/import projection; the graph is the source of truth.
 *   - A choice fans out edges (one port per choice), not a node-level edge.
 *   - Requirements/Outcomes are ordered child arrays, never separate rows.
 *   - Schema is versioned; Run 1 ships an embedded NPC-dialogue schema.
 */
export const REQUIREMENT_TYPES = [
    'None',
    'HasItemTag',
    'WorldFlagAtLeast',
    'PersonaAtLeast',
];
export const OUTCOME_TYPES = [
    'None',
    'SetWorldFlag',
    'TakeItem',
    'AdjustPersona',
];
//# sourceMappingURL=types.js.map