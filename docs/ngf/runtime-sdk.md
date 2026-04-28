# NGF Runtime SDK

Phase 10의 런타임 산출물은 편집용 `NarrativeGraph`와 분리된다.

## Artifacts

- Normalized JSON: `exportNormalizedJson(graph)`
  - CSV/Editor projection을 제거한 안정적인 graph JSON.
  - `position`, `uiState` 같은 editor-only 필드는 포함하지 않는다.
- Runtime Bundle: `buildRuntimeBundle(graph)`
  - `tables.nodeIds`, `tables.choiceIds`로 원본 ID를 보존한다.
  - node/choice 참조는 숫자 index로 압축한다.
  - `entries`는 runtime start resolver가 우선 확인하는 node index 목록이다.

## TypeScript Runtime

```ts
import {
  advanceRuntimeChoice,
  buildRuntimeBundle,
  createRuntimePlayerState,
  getRuntimeChoices,
  resolveRuntimeEntry,
} from '@ngf/runtime';

const bundle = buildRuntimeBundle(graph, { entryNodeMaxIndex: 5 });
const state = createRuntimePlayerState({ itemTags: ['Item.Part.SpeakerModule'] });
const node = resolveRuntimeEntry(bundle, state);

if (node) {
  const choices = getRuntimeChoices(node, state);
  const first = choices.find((choice) => choice.available);
  if (first) {
    const result = advanceRuntimeChoice(bundle, state, node.id, first.choice.id);
    console.log(result.currentNode, result.state, result.appliedOutcomes);
  }
}
```

## Unity C# Adapter Sketch

```csharp
[Serializable]
public sealed class NgfRuntimeBundle {
  public string format;
  public int version;
  public string[] entries;
  public NgfTables tables;
  public NgfNode[] nodes;
}

[Serializable]
public sealed class NgfTables {
  public string[] nodeIds;
  public string[] choiceIds;
}

[Serializable]
public sealed class NgfNode {
  public int id;
  public string npcId;
  public int nodeIndex;
  public string speaker;
  public string text;
  public string guardFlag;
  public int autoNext = -1;
  public NgfChoice[] choices;
}

[Serializable]
public sealed class NgfChoice {
  public int id;
  public int choiceIndex;
  public string text;
  public int next = -1;
  public string requiredWorldFlag;
  public string blockingWorldFlag;
  public NgfRequirement[] requirements;
  public NgfOutcome[] outcomes;
}
```

Unity 쪽 구현은 JSON 파서로 bundle을 로드한 뒤 TypeScript SDK와 같은 순서로
`guardFlag` → choice flag gates → requirements → outcomes를 평가하면 된다.
