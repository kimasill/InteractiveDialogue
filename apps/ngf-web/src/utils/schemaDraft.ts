export type SchemaFieldType = 'string' | 'number' | 'boolean' | 'nodeRef' | 'enum' | 'text';
export type SchemaWidget = 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'node-picker' | 'badge';
export type SchemaRuleKind = 'required' | 'min' | 'max' | 'pattern' | 'enum';

export interface SchemaRule {
  id: string;
  kind: SchemaRuleKind;
  value: string;
  message: string;
}

export interface SchemaField {
  id: string;
  name: string;
  label: string;
  type: SchemaFieldType;
  widget: SchemaWidget;
  enumId?: string;
  required?: boolean;
  rules: SchemaRule[];
}

export interface SchemaEntity {
  id: string;
  name: string;
  label: string;
  fields: SchemaField[];
}

export interface SchemaEnum {
  id: string;
  name: string;
  values: string[];
}

export interface SchemaDraft {
  id: string;
  name: string;
  version: number;
  entities: SchemaEntity[];
  enums: SchemaEnum[];
}

export interface MigrationChange {
  kind: 'add_entity' | 'remove_entity' | 'add_field' | 'remove_field' | 'change_field_type' | 'change_widget' | 'change_enum';
  label: string;
}

function idFromName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
}

export function createField(name: string, type: SchemaFieldType = 'string'): SchemaField {
  const id = idFromName(name);
  return {
    id,
    name: id,
    label: name.trim() || 'New Field',
    type,
    widget: defaultWidgetForType(type),
    required: false,
    rules: [],
  };
}

export function createRule(kind: SchemaRuleKind = 'required'): SchemaRule {
  return {
    id: `rule_${Date.now().toString(36)}`,
    kind,
    value: '',
    message: kind === 'required' ? 'Field is required.' : '',
  };
}

export function defaultWidgetForType(type: SchemaFieldType): SchemaWidget {
  switch (type) {
    case 'text':
      return 'textarea';
    case 'number':
      return 'number';
    case 'boolean':
      return 'checkbox';
    case 'nodeRef':
      return 'node-picker';
    case 'enum':
      return 'select';
    case 'string':
      return 'text';
  }
}

export const DEFAULT_SCHEMA_DRAFT: SchemaDraft = {
  id: 'schema_v1_npc_dialogue',
  name: 'NPC Dialogue v1',
  version: 1,
  enums: [
    { id: 'requirement_type', name: 'RequirementType', values: ['None', 'HasItemTag', 'WorldFlagAtLeast', 'PersonaAtLeast'] },
    { id: 'outcome_type', name: 'OutcomeType', values: ['None', 'SetWorldFlag', 'TakeItem', 'AdjustPersona'] },
  ],
  entities: [
    {
      id: 'dialogue_node',
      name: 'DialogueNode',
      label: 'Dialogue Node',
      fields: [
        { ...createField('Title', 'string'), id: 'nodeTitle', name: 'nodeTitle', widget: 'text' },
        { ...createField('Speaker', 'string'), id: 'speakerName', name: 'speakerName', required: true },
        { ...createField('Dialogue', 'text'), id: 'dialogueText', name: 'dialogueText', required: true },
        { ...createField('Guard Flag', 'string'), id: 'requiredWorldFlag', name: 'requiredWorldFlag', widget: 'badge' },
        { ...createField('Auto Next', 'nodeRef'), id: 'autoNextNodeId', name: 'autoNextNodeId' },
      ],
    },
    {
      id: 'choice',
      name: 'Choice',
      label: 'Choice',
      fields: [
        { ...createField('Choice Text', 'text'), id: 'text', name: 'text', required: true },
        { ...createField('Next Node', 'nodeRef'), id: 'nextNodeId', name: 'nextNodeId' },
        { ...createField('Required Flag', 'string'), id: 'requiredWorldFlag', name: 'requiredWorldFlag' },
        { ...createField('Blocking Flag', 'string'), id: 'blockingWorldFlag', name: 'blockingWorldFlag' },
      ],
    },
  ],
};

export function cloneSchemaDraft(schema: SchemaDraft): SchemaDraft {
  return JSON.parse(JSON.stringify(schema)) as SchemaDraft;
}

export function getNodeEntity(schema: SchemaDraft): SchemaEntity | undefined {
  return schema.entities.find((entity) => entity.id === 'dialogue_node');
}

export function diffSchemaDraft(previous: SchemaDraft, next: SchemaDraft): MigrationChange[] {
  const changes: MigrationChange[] = [];
  const previousEntities = new Map(previous.entities.map((entity) => [entity.id, entity]));
  const nextEntities = new Map(next.entities.map((entity) => [entity.id, entity]));

  for (const entity of next.entities) {
    const oldEntity = previousEntities.get(entity.id);
    if (!oldEntity) {
      changes.push({ kind: 'add_entity', label: `Add entity ${entity.label}` });
      continue;
    }

    const oldFields = new Map(oldEntity.fields.map((field) => [field.id, field]));
    const newFields = new Map(entity.fields.map((field) => [field.id, field]));
    for (const field of entity.fields) {
      const oldField = oldFields.get(field.id);
      if (!oldField) changes.push({ kind: 'add_field', label: `Add ${entity.label}.${field.label}` });
      else {
        if (oldField.type !== field.type) changes.push({ kind: 'change_field_type', label: `Change ${entity.label}.${field.label} type ${oldField.type} -> ${field.type}` });
        if (oldField.widget !== field.widget) changes.push({ kind: 'change_widget', label: `Change ${entity.label}.${field.label} widget ${oldField.widget} -> ${field.widget}` });
        if (oldField.enumId !== field.enumId) changes.push({ kind: 'change_enum', label: `Change ${entity.label}.${field.label} enum binding` });
      }
    }
    for (const field of oldEntity.fields) {
      if (!newFields.has(field.id)) changes.push({ kind: 'remove_field', label: `Remove ${entity.label}.${field.label}` });
    }
  }

  for (const entity of previous.entities) {
    if (!nextEntities.has(entity.id)) changes.push({ kind: 'remove_entity', label: `Remove entity ${entity.label}` });
  }

  return changes;
}
