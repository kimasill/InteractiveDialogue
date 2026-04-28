import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import type { SchemaFieldType, SchemaRuleKind, SchemaWidget } from '../utils/schemaDraft';

const FIELD_TYPES: SchemaFieldType[] = ['string', 'text', 'number', 'boolean', 'nodeRef', 'enum'];
const WIDGETS: SchemaWidget[] = ['text', 'textarea', 'number', 'checkbox', 'select', 'node-picker', 'badge'];
const RULES: SchemaRuleKind[] = ['required', 'min', 'max', 'pattern', 'enum'];

export function SchemaPanel() {
  const {
    schemaDraft,
    setSchemaName,
    addSchemaEntity,
    updateSchemaEntity,
    removeSchemaEntity,
    addSchemaField,
    updateSchemaField,
    removeSchemaField,
    addSchemaEnum,
    updateSchemaEnum,
    removeSchemaEnum,
    addSchemaRule,
    updateSchemaRule,
    removeSchemaRule,
    commitSchemaVersion,
    getSchemaMigrationPreview,
  } = useAppStore();
  const [entityName, setEntityName] = useState('');
  const [enumName, setEnumName] = useState('');
  const [newFieldByEntity, setNewFieldByEntity] = useState<Record<string, string>>({});
  const migration = useMemo(() => getSchemaMigrationPreview(), [schemaDraft, getSchemaMigrationPreview]);

  return (
    <div className="schema-panel">
      <div className="schema-column schema-column--entities">
        <div className="schema-head">
          <div>
            <div className="schema-title">Schema</div>
            <div className="schema-subtitle">v{schemaDraft.version}</div>
          </div>
          <button className="bottom-panel-btn bottom-panel-btn--strong" onClick={commitSchemaVersion}>Commit Version</button>
        </div>
        <label className="schema-label">
          Name
          <input className="schema-input" value={schemaDraft.name} onChange={(event) => setSchemaName(event.target.value)} />
        </label>
        <div className="schema-add-row">
          <input className="schema-input" value={entityName} placeholder="Entity name" onChange={(event) => setEntityName(event.target.value)} />
          <button className="bottom-panel-btn" onClick={() => { addSchemaEntity(entityName); setEntityName(''); }}>Add Entity</button>
        </div>
        <div className="schema-entity-list">
          {schemaDraft.entities.map((entity) => (
            <div key={entity.id} className="schema-entity">
              <div className="schema-entity-head">
                <input className="schema-input schema-input--name" value={entity.label} onChange={(event) => updateSchemaEntity(entity.id, { label: event.target.value })} />
                <button className="schema-icon-btn" onClick={() => removeSchemaEntity(entity.id)}>x</button>
              </div>
              <div className="schema-add-row">
                <input
                  className="schema-input"
                  value={newFieldByEntity[entity.id] ?? ''}
                  placeholder="Field name"
                  onChange={(event) => setNewFieldByEntity((current) => ({ ...current, [entity.id]: event.target.value }))}
                />
                <button
                  className="bottom-panel-btn"
                  onClick={() => {
                    addSchemaField(entity.id, newFieldByEntity[entity.id] ?? '');
                    setNewFieldByEntity((current) => ({ ...current, [entity.id]: '' }));
                  }}
                >
                  Add Field
                </button>
              </div>
              <div className="schema-field-list">
                {entity.fields.map((field) => (
                  <div key={field.id} className="schema-field">
                    <div className="schema-field-grid">
                      <label className="schema-label">
                        Label
                        <input className="schema-input" value={field.label} onChange={(event) => updateSchemaField(entity.id, field.id, { label: event.target.value })} />
                      </label>
                      <label className="schema-label">
                        Name
                        <input className="schema-input" value={field.name} onChange={(event) => updateSchemaField(entity.id, field.id, { name: event.target.value })} />
                      </label>
                      <label className="schema-label">
                        Type
                        <select className="schema-input" value={field.type} onChange={(event) => updateSchemaField(entity.id, field.id, { type: event.target.value as SchemaFieldType })}>
                          {FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </label>
                      <label className="schema-label">
                        Widget
                        <select className="schema-input" value={field.widget} onChange={(event) => updateSchemaField(entity.id, field.id, { widget: event.target.value as SchemaWidget })}>
                          {WIDGETS.map((widget) => <option key={widget} value={widget}>{widget}</option>)}
                        </select>
                      </label>
                      <label className="schema-check">
                        <input type="checkbox" checked={field.required ?? false} onChange={(event) => updateSchemaField(entity.id, field.id, { required: event.target.checked })} />
                        Required
                      </label>
                      {field.type === 'enum' && (
                        <label className="schema-label">
                          Enum
                          <select className="schema-input" value={field.enumId ?? ''} onChange={(event) => updateSchemaField(entity.id, field.id, { enumId: event.target.value })}>
                            <option value="">None</option>
                            {schemaDraft.enums.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </label>
                      )}
                    </div>
                    <div className="schema-rule-list">
                      {field.rules.map((rule) => (
                        <div key={rule.id} className="schema-rule">
                          <select className="schema-input" value={rule.kind} onChange={(event) => updateSchemaRule(entity.id, field.id, rule.id, { kind: event.target.value as SchemaRuleKind })}>
                            {RULES.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                          </select>
                          <input className="schema-input" value={rule.value} placeholder="Value" onChange={(event) => updateSchemaRule(entity.id, field.id, rule.id, { value: event.target.value })} />
                          <input className="schema-input" value={rule.message} placeholder="Message" onChange={(event) => updateSchemaRule(entity.id, field.id, rule.id, { message: event.target.value })} />
                          <button className="schema-icon-btn" onClick={() => removeSchemaRule(entity.id, field.id, rule.id)}>x</button>
                        </div>
                      ))}
                      <button className="schema-small-link" onClick={() => addSchemaRule(entity.id, field.id)}>Add rule</button>
                      <button className="schema-small-link schema-small-link--danger" onClick={() => removeSchemaField(entity.id, field.id)}>Remove field</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="schema-column">
        <div className="schema-title">Enums</div>
        <div className="schema-add-row">
          <input className="schema-input" value={enumName} placeholder="Enum name" onChange={(event) => setEnumName(event.target.value)} />
          <button className="bottom-panel-btn" onClick={() => { addSchemaEnum(enumName); setEnumName(''); }}>Add Enum</button>
        </div>
        {schemaDraft.enums.map((item) => (
          <div key={item.id} className="schema-enum">
            <div className="schema-entity-head">
              <input className="schema-input schema-input--name" value={item.name} onChange={(event) => updateSchemaEnum(item.id, { name: event.target.value })} />
              <button className="schema-icon-btn" onClick={() => removeSchemaEnum(item.id)}>x</button>
            </div>
            <textarea
              className="schema-textarea"
              value={item.values.join('\n')}
              onChange={(event) => updateSchemaEnum(item.id, { values: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })}
            />
          </div>
        ))}
      </div>

      <div className="schema-column">
        <div className="schema-title">Migration Preview</div>
        <div className="schema-subtitle">{migration.length} pending change(s)</div>
        <div className="schema-migration-list">
          {migration.length === 0 ? (
            <div className="schema-empty">No schema changes.</div>
          ) : (
            migration.map((change, index) => (
              <div key={`${change.kind}:${index}`} className="schema-migration">
                <span>{change.kind}</span>
                {change.label}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
