import { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { evaluateChoices, indexGraph } from '../utils/playtest';

export function PlaytestPanel() {
  const {
    graph,
    selectedNodeId,
    playtest,
    startPlaytest,
    resetPlaytest,
    setPlaytestPersona,
    setPlaytestWorldFlag,
    removePlaytestWorldFlag,
    addPlaytestItemTag,
    removePlaytestItemTag,
    choosePlaytestChoice,
    advancePlaytestAuto,
    selectNode,
  } = useAppStore();
  const [flagName, setFlagName] = useState('');
  const [flagValue, setFlagValue] = useState(1);
  const [itemTag, setItemTag] = useState('');

  const currentNode = useMemo(() => {
    if (!graph || !playtest.currentNodeId) return null;
    return indexGraph(graph).get(playtest.currentNodeId) ?? null;
  }, [graph, playtest.currentNodeId]);

  const choices = useMemo(() => {
    if (!currentNode) return [];
    return evaluateChoices(currentNode, playtest.playerState);
  }, [currentNode, playtest.playerState]);

  const entryOptions = useMemo(() => {
    if (!graph) return [];
    return [...graph.nodes].sort((a, b) => a.nodeIndex - b.nodeIndex || a.npcId.localeCompare(b.npcId));
  }, [graph]);

  if (!graph) return null;

  function addFlag() {
    setPlaytestWorldFlag(flagName, flagValue);
    setFlagName('');
    setFlagValue(1);
  }

  function addItem() {
    addPlaytestItemTag(itemTag);
    setItemTag('');
  }

  return (
    <div className="playtest-panel">
      <div className="playtest-state">
        <div className="playtest-block">
          <div className="playtest-block-head">
            <span>Player State</span>
            <button className="bottom-panel-btn" onClick={resetPlaytest}>Reset</button>
          </div>
          <label className="playtest-label">
            Persona
            <input
              className="playtest-input"
              type="number"
              value={playtest.playerState.persona}
              onChange={(event) => setPlaytestPersona(Number(event.target.value) || 0)}
            />
          </label>
          <div className="playtest-inline-form">
            <input
              className="playtest-input"
              value={flagName}
              placeholder="WorldFlag"
              onChange={(event) => setFlagName(event.target.value)}
            />
            <input
              className="playtest-input playtest-input--small"
              type="number"
              value={flagValue}
              onChange={(event) => setFlagValue(Number(event.target.value) || 0)}
            />
            <button className="bottom-panel-btn" onClick={addFlag}>Add Flag</button>
          </div>
          <div className="playtest-tags">
            {Object.entries(playtest.playerState.worldFlags).map(([flag, value]) => (
              <button key={flag} className="playtest-tag" onClick={() => removePlaytestWorldFlag(flag)}>
                {flag}:{value}
              </button>
            ))}
          </div>
          <div className="playtest-inline-form">
            <input
              className="playtest-input"
              value={itemTag}
              placeholder="ItemTag"
              onChange={(event) => setItemTag(event.target.value)}
            />
            <button className="bottom-panel-btn" onClick={addItem}>Add Item</button>
          </div>
          <div className="playtest-tags">
            {playtest.playerState.itemTags.map((tag) => (
              <button key={tag} className="playtest-tag" onClick={() => removePlaytestItemTag(tag)}>
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="playtest-block playtest-block--main">
          <div className="playtest-block-head">
            <span>Run</span>
            <select
              className="playtest-select"
              value={selectedNodeId ?? ''}
              onChange={(event) => selectNode(event.target.value || null)}
            >
              <option value="">Auto entry</option>
              {entryOptions.map((node) => (
                <option key={node.id} value={node.id}>{node.id}</option>
              ))}
            </select>
            <button className="bottom-panel-btn bottom-panel-btn--strong" onClick={() => startPlaytest(selectedNodeId)}>
              Start
            </button>
          </div>

          {currentNode ? (
            <div className="playtest-node">
              <div className="playtest-node-id">{currentNode.id}</div>
              <div className="playtest-speaker">{currentNode.speakerName || 'No speaker'}</div>
              <div className="playtest-dialogue">{currentNode.dialogueText || 'No dialogue text'}</div>
              {currentNode.autoNextNodeId && (
                <button className="playtest-auto-btn" onClick={advancePlaytestAuto}>
                  Auto to {currentNode.autoNextNodeId}
                </button>
              )}
              <div className="playtest-choice-list">
                {choices.map((entry) => (
                  <div key={entry.choice.id} className={`playtest-choice${entry.available ? '' : ' playtest-choice--locked'}`}>
                    <button
                      className="playtest-choice-btn"
                      disabled={!entry.available}
                      onClick={() => choosePlaytestChoice(entry.choice.id)}
                    >
                      <span>{entry.choice.choiceIndex}</span>
                      {entry.choice.text || 'Untitled choice'}
                    </button>
                    {entry.checks.length > 0 && (
                      <div className="playtest-checks">
                        {entry.checks.map((check, index) => (
                          <span key={index} className={check.met ? 'playtest-check--met' : 'playtest-check--fail'}>
                            {check.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="playtest-empty">Start playtest from an entry node.</div>
          )}
          {playtest.message && <div className="playtest-message">{playtest.message}</div>}
        </div>

        <div className="playtest-block">
          <div className="playtest-block-head">
            <span>Trace</span>
            <span>{playtest.trace.length} steps</span>
          </div>
          <div className="playtest-trace">
            {playtest.trace.map((entry, index) => (
              <button key={`${entry.nodeId}:${index}`} className="playtest-trace-item" onClick={() => selectNode(entry.nodeId)}>
                <span>{index + 1}. {entry.nodeId}</span>
                {entry.choiceText && <span>{entry.choiceText}</span>}
                {entry.outcomes.length > 0 && <span>{entry.outcomes.join(', ')}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
