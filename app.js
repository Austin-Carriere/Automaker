
const socket = new WebSocket("ws://192.168.43.1:9400");

function updateSocketStatus(state) {
  socketStatus.classList.remove(
    "socket-status-connected",
    "socket-status-connecting",
    "socket-status-disconnected"
  );

  if (state === "connected") {
    socketStatus.classList.add("socket-status-connected");
    socketStatusText.textContent = "Connected";
    return;
  }

  if (state === "disconnected") {
    socketStatus.classList.add("socket-status-disconnected");
    socketStatusText.textContent = "Disconnected";
    return;
  }

  socketStatus.classList.add("socket-status-connecting");
  socketStatusText.textContent = "Connecting";
}

socket.onopen = () => {
  updateSocketStatus("connected");
  console.log("WebSocket connection established");       
};

socket.onclose = () => {
  updateSocketStatus("disconnected");
  console.log("WebSocket connection closed");
};

socket.onerror = () => {
  updateSocketStatus("disconnected");
  console.log("WebSocket connection error");
};

socket.onmessage = (event) => {
  const message = String(event.data ?? "");
  
  const parsedSavedAutos = parseSavedAutosMessage(message);
  if (!parsedSavedAutos) {
    console.log("WebSocket message received:", message);
    return;
  }

  debugSavedAutos = parsedSavedAutos;
  savedAutos = parsedSavedAutos;
  renderSavedAutos();
};



const initialBlocks = [
  {
    id: "shootclose",
    title: "Shoot Close",
    description: "Drive to the close launch and shoot 3 artifacts."
  },
  {
    id: "shootfar",
    title: "Shoot Far",
    description: "Drive to the far launch and shoot 3 artifacts."
  },
  {
    id: "collectspike1",
    title: "Collect Spike 1",
    description: "Navigate to and collect the spike closest to the far launch zone."
  },
  {
    id: "collectspike2",
    title: "Collect Spike 2",
    description: "Navigate to and collect the spike that is in between the other spikes."
  },
  {
    id: "collectspike3",
    title: "Collect Spike 3",
    description: "Navigate to and collect the spike closest to the close launch zone."
  },
  {
    id: "emptygate",
    title: "Empty Gate",
    description: "Push the gate to open it and release the artifacts."
  },
  {
    id: "wait",
    title: "Wait",
    description: "Pause for a specified amount of time.",
    type: "integer"
  },
  {
    id: "movetospike1",
    title: "Move to Spike 1",
    description: "Navigate to the spike closest to the far launch zone."
  },
  {
    id: "movetospike2",
    title: "Move to Spike 2",
    description: "Navigate to the spike that is in between the other spikes." 
  },
  {
    id: "movetospike3",
    title: "Move to Spike 3",
    description: "Navigate to the spike closest to the close launch zone."
  }
  
  
];

const bankList = document.getElementById("bankList");
const workspaceList = document.getElementById("workspaceList");
const workspaceDropzone = document.getElementById("workspaceDropzone");
const workspaceEmpty = document.getElementById("workspaceEmpty");
const blockTemplate = document.getElementById("blockTemplate");
const sequenceCount = document.getElementById("sequenceCount");
const resetButton = document.getElementById("resetButton");
const submitButton = document.getElementById("submitButton");
const editSavedAutosButton = document.getElementById("editSavedAutosButton");
const blockSearchInput = document.getElementById("blockSearchInput");
const autonomousNameInput = document.getElementById("autonomousNameInput");
const nameLockButton = document.getElementById("nameLockButton");
const submissionResult = document.getElementById("submissionResult");
const socketStatus = document.getElementById("socketStatus");
const socketStatusText = document.getElementById("socketStatusText");
const startCloseButton = document.getElementById("startCloseButton");
const startFarButton = document.getElementById("startFarButton");
const savedAutosModal = document.getElementById("savedAutosModal");
const savedAutosBackdrop = document.getElementById("savedAutosBackdrop");
const savedAutosList = document.getElementById("savedAutosList");
const savedAutosStatus = document.getElementById("savedAutosStatus");
const closeSavedAutosButton = document.getElementById("closeSavedAutosButton");
const newAutoInput = document.getElementById("newAutoInput");
const saveNewAutoButton = document.getElementById("saveNewAutoButton");
const copyAutoStringButton = document.getElementById("copyAutoStringButton");

let workspaceBlocks = [];
let draggedItem = null;
let nextInstanceId = 1;
let dropHandledInWorkspace = false;
let startMode = "close";
let savedAutos = [];
let isNameLocked = false;
let debugSavedAutos = [];
let blockSearchQuery = "";
let invalidSaveNewAutoTimeoutId = null;

function getSerializedWorkspaceSequence() {
  return workspaceBlocks.map(serializeBlock).join(",");
}

function getSavedAutoSequenceString() {
  const serializedSequence = getSerializedWorkspaceSequence();
  return serializedSequence ? `${startMode},${serializedSequence}` : startMode;
}

function getSavedAutoEntryString() {
  const autonomousName = autonomousNameInput.value.trim();
  return `${autonomousName}/${getSavedAutoSequenceString()}`;
}

function getSubmissionPayload() {
  const autonomousName = autonomousNameInput.value.trim();
  return "Plugin: AutoMaker" + "\n" + "AutoMaker " + autonomousName + "/" + getSavedAutoSequenceString();
}

function flashInvalidSaveNewAutoButton() {
  if (invalidSaveNewAutoTimeoutId) {
    clearTimeout(invalidSaveNewAutoTimeoutId);
  }

  saveNewAutoButton.textContent = "Invalid";
  saveNewAutoButton.classList.add("is-invalid");

  invalidSaveNewAutoTimeoutId = window.setTimeout(() => {
    saveNewAutoButton.textContent = "Save New Auto";
    saveNewAutoButton.classList.remove("is-invalid");
    invalidSaveNewAutoTimeoutId = null;
  }, 500);
}

function setStartMode(nextMode) {
  startMode = nextMode;

  startCloseButton.classList.toggle("is-active", nextMode === "close");
  startFarButton.classList.toggle("is-active", nextMode === "far");
  startCloseButton.setAttribute("aria-pressed", String(nextMode === "close"));
  startFarButton.setAttribute("aria-pressed", String(nextMode === "far"));
}

function setNameLockState(nextLocked) {
  isNameLocked = nextLocked;
  nameLockButton.textContent = nextLocked ? "Locked" : "Unlock";
  nameLockButton.setAttribute("aria-pressed", String(nextLocked));
}

function openSavedAutosModal() {
  savedAutosModal.hidden = false;
}

function closeSavedAutosModal() {
  savedAutosModal.hidden = true;
}

function renderSavedAutos(emptyStateMessage = "No saved autonomous files were returned by the robot.") {
  savedAutosList.innerHTML = "";

  if (savedAutos.length === 0) {
    savedAutosStatus.textContent = emptyStateMessage;
    return;
  }

  savedAutosStatus.textContent = "Choose a saved autonomous to load it into the workspace.";

  savedAutos.forEach((savedAuto) => {
    const item = document.createElement("div");
    item.className = "saved-auto-item";

    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "saved-auto-load-button";
    loadButton.textContent = savedAuto.name;
    loadButton.addEventListener("click", () => loadSavedAuto(savedAuto));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "saved-auto-delete-button";
    deleteButton.setAttribute("aria-label", `Delete ${savedAuto.name}`);
    deleteButton.textContent = "x";
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteSavedAuto(savedAuto);
    });

    item.appendChild(loadButton);
    item.appendChild(deleteButton);
    savedAutosList.appendChild(item);
  });
}

function deleteSavedAuto(savedAuto) {
  const deletePayload = "Plugin: AutoMaker" + "\n" + "Delete " + savedAuto.name;
  socket.send(deletePayload);
  savedAutos = savedAutos.filter((entry) => entry.name !== savedAuto.name);
  renderSavedAutos("No saved autonomous files were returned by the robot.");
  submissionResult.hidden = false;
  submissionResult.textContent = `Sent delete request for "${savedAuto.name}".`;
  console.log("Sent message:", deletePayload);
}

function parseSavedAutosMessage(message) {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return null;
  }

  const pluginPayload = trimmedMessage
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      if (index === 0) {
        if (!entry.startsWith("SAVEDAUTO")) {
          return null;
        }

        entry = entry.slice("SAVEDAUTO".length).trim();
        if (!entry) {
          return null;
        }
      }

      if (entry.startsWith("AutoMaker ")) {
        entry = entry.slice("AutoMaker ".length).trim();
      }

      const nameSeparatorIndex = entry.indexOf("/");
      if (nameSeparatorIndex === -1) {
        return null;
      }

      const name = entry.slice(0, nameSeparatorIndex).trim();
      const payload = entry.slice(nameSeparatorIndex + 1).trim();
      if (!name || !payload) {
        return null;
      }

      return { name, payload };
    })
    .filter(Boolean);

  if (pluginPayload.length > 0) {
    return pluginPayload;
  }

  const parsedEntries =
    trimmedMessage.includes("$") && trimmedMessage.includes("|")
      ? trimmedMessage
          .split("|")
          .map((entry) => entry.trim())
          .filter(Boolean)
          .map((entry) => {
            const separatorIndex = entry.indexOf("$");
            if (separatorIndex === -1) {
              return null;
            }

            const name = entry.slice(0, separatorIndex).trim();
            const payload = entry.slice(separatorIndex + 1).trim();

            if (!name || !payload) {
              return null;
            }

            return { name, payload };
          })
          .filter(Boolean)
      : [];

  if (parsedEntries.length > 0) {
    return parsedEntries;
  }

  const directNameSeparatorIndex = trimmedMessage.indexOf("/");
  if (directNameSeparatorIndex === -1) {
    return null;
  }

  const directName = trimmedMessage.slice(0, directNameSeparatorIndex).trim();
  const directPayload = trimmedMessage.slice(directNameSeparatorIndex + 1).trim();

  if (!directName || !directPayload) {
    return null;
  }

  return [
    {
      name: directName,
      payload: directPayload
    }
  ];
}

function deserializeSequencePayload(payload) {
  const parts = payload
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const nextStartMode = parts[0] === "far" ? "far" : "close";
  const nextBlocks = [];

  parts.slice(1).forEach((part) => {
    const [blockId, rawValue] = part.split("!");
    const block = initialBlocks.find((item) => item.id === blockId);

    if (!block) {
      return;
    }

    nextBlocks.push({
      ...block,
      instanceId: `workspace-${nextInstanceId}`,
      value: block.type === "integer" ? (rawValue && rawValue !== "unset" ? rawValue : "") : undefined
    });
    nextInstanceId += 1;
  });

  return {
    startMode: nextStartMode,
    blocks: nextBlocks
  };
}

function loadSavedAuto(savedAuto) {
  const loadedSequence = deserializeSequencePayload(savedAuto.payload);

  if (!loadedSequence) {
    submissionResult.hidden = false;
    submissionResult.textContent = `Unable to load "${savedAuto.name}" because the saved data was empty.`;
    return;
  }

  autonomousNameInput.value = savedAuto.name;
  setStartMode(loadedSequence.startMode);
  workspaceBlocks = loadedSequence.blocks;
  submissionResult.hidden = false;
  submissionResult.textContent = `Loaded saved autonomous "${savedAuto.name}" into the workspace.`;
  closeSavedAutosModal();
  render();
}

function loadSavedAutoFromInput() {
  const rawInput = newAutoInput.value.trim();

  if (!rawInput) {
    submissionResult.hidden = false;
    submissionResult.textContent = "Enter a saved auto string to load it into the workspace.";
    flashInvalidSaveNewAutoButton();
    return;
  }

  const parsedSavedAutos = parseSavedAutosMessage(rawInput);
  const savedAutoToLoad = parsedSavedAutos?.[0];

  if (!savedAutoToLoad) {
    submissionResult.hidden = false;
    submissionResult.textContent = "Unable to parse that saved auto string.";
    flashInvalidSaveNewAutoButton();
    return;
  }

  loadSavedAuto(savedAutoToLoad);
  newAutoInput.value = "";
}

async function copyAutoStringToClipboard() {
  const savedAutoEntryString = getSavedAutoEntryString();

  try {
    await navigator.clipboard.writeText(savedAutoEntryString);
    submissionResult.hidden = false;
    submissionResult.textContent = "Copied the saved auto string to the clipboard.";
  } catch (error) {
    submissionResult.hidden = false;
    submissionResult.textContent = "Unable to copy the saved auto string to the clipboard.";
    console.log("Clipboard copy failed:", error);
  }
}

function captureWorkspacePositions() {
  const positions = new Map();

  workspaceList.querySelectorAll(".sequence-block.in-workspace").forEach((node) => {
    positions.set(node.dataset.instanceId, node.getBoundingClientRect());
  });

  return positions;
}

function animateWorkspaceTiles(previousPositions) {
  workspaceList.querySelectorAll(".sequence-block.in-workspace").forEach((node) => {
    const previousRect = previousPositions.get(node.dataset.instanceId);
    if (!previousRect) {
      node.animate(
        [
          { opacity: 0, transform: "translateY(18px) scale(0.96)" },
          { opacity: 1, transform: "translateY(0) scale(1)" }
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
        }
      );
      return;
    }

    const nextRect = node.getBoundingClientRect();
    const deltaX = previousRect.left - nextRect.left;
    const deltaY = previousRect.top - nextRect.top;

    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    node.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: "translate(0, 0)" }
      ],
      {
        duration: 240,
        easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
      }
    );
  });
}

function updateCount() {
  sequenceCount.textContent = `${workspaceBlocks.length} Blocks`;
}

function addBlockToWorkspace(blockId, insertIndex = workspaceBlocks.length) {
  const block = initialBlocks.find((item) => item.id === blockId);
  if (!block) {
    return;
  }

  const nextBlocks = [...workspaceBlocks];
  nextBlocks.splice(insertIndex, 0, {
    ...block,
    instanceId: `workspace-${nextInstanceId}`,
    value: block.type === "integer" ? "" : undefined
  });
  nextInstanceId += 1;
  workspaceBlocks = nextBlocks;
  render();
}

function removeBlockFromWorkspace(instanceId) {
  workspaceBlocks = workspaceBlocks.filter((block) => block.instanceId !== instanceId);
  render();
}

function updateWorkspaceBlockValue(instanceId, nextValue) {
  workspaceBlocks = workspaceBlocks.map((block) => {
    if (block.instanceId !== instanceId) {
      return block;
    }

    return {
      ...block,
      value: nextValue
    };
  });
}

function serializeBlock(block) {
  if (block.type === "integer") {
    return `${block.id}!${block.value === "" ? "unset" : block.value}`;
  }

  return block.id;
}

function submitSequence() {
  submissionResult.hidden = false;
  const autonomousName = autonomousNameInput.value.trim();

  if (workspaceBlocks.length === 0) {
    submissionResult.textContent = "No blocks are in the workspace yet. Add a few blocks, then submit the sequence.";
    return;
  }

  const sequenceLabel = workspaceBlocks
   .map((block, index) => {
     if (block.type === "integer") {
       return `${index + 1}. ${block.title} (${block.value === "" ? "unset" : block.value})`;
     }

     return `${index + 1}. ${block.title}`;
   })
   .join("  |  ");
  const submissionPayload = getSubmissionPayload();
  submissionResult.textContent =
    `Submitted sequence${autonomousName ? ` "${autonomousName}"` : ""} ` +
    `(${startMode === "close" ? "Start Close" : "Start Far"}): ${sequenceLabel}`;
  console.log("Submitted sequence:", submissionPayload);
  socket.send(submissionPayload);
}

function moveWorkspaceBlock(fromIndex, toIndex) {
  if (fromIndex === toIndex || toIndex < 0 || toIndex > workspaceBlocks.length) {
    return;
  }

  const nextBlocks = [...workspaceBlocks];
  const [movedBlock] = nextBlocks.splice(fromIndex, 1);
  nextBlocks.splice(toIndex, 0, movedBlock);
  workspaceBlocks = nextBlocks;
  render();
}

function clearDragTargets() {
  document.querySelectorAll(".drag-target").forEach((element) => {
    element.classList.remove("drag-target");
  });

  workspaceDropzone.classList.remove("drag-over");
}

function createBlockNode(block, options) {
  const { context, index = null } = options;
  const blockNode = blockTemplate.content.firstElementChild.cloneNode(true);
  const indexNode = blockNode.querySelector(".block-index");
  const titleNode = blockNode.querySelector(".block-title");
  const descriptionNode = blockNode.querySelector(".block-description");
  const addButton = blockNode.querySelector('[data-action="add"]');
  const removeButton = blockNode.querySelector('[data-action="remove"]');
  const upButton = blockNode.querySelector('[data-action="up"]');
  const downButton = blockNode.querySelector('[data-action="down"]');

  blockNode.dataset.id = block.id;
  titleNode.textContent = block.title;
  descriptionNode.textContent = block.description;

  if (context === "bank") {
    blockNode.classList.add("in-bank");
    indexNode.textContent = "+";
    addButton.hidden = false;
    removeButton.hidden = true;
    upButton.hidden = true;
    downButton.hidden = true;
    addButton.disabled = false;
    addButton.addEventListener("click", () => addBlockToWorkspace(block.id));
  }

  if (context === "workspace") {
    blockNode.classList.add("in-workspace");
    blockNode.dataset.index = String(index);
    blockNode.dataset.instanceId = block.instanceId;
    indexNode.textContent = String(index + 1).padStart(2, "0");
    addButton.hidden = true;
    removeButton.hidden = false;
    upButton.hidden = false;
    downButton.hidden = false;
    removeButton.disabled = false;
    upButton.disabled = index === 0;
    downButton.disabled = index === workspaceBlocks.length - 1;
    removeButton.addEventListener("click", () => removeBlockFromWorkspace(block.instanceId));
    upButton.addEventListener("click", () => moveWorkspaceBlock(index, index - 1));
    downButton.addEventListener("click", () => moveWorkspaceBlock(index, index + 1));

    if (block.type === "integer") {
      const inputWrap = document.createElement("div");
      const inputLabel = document.createElement("label");
      const inputNode = document.createElement("input");

      inputWrap.className = "block-input-wrap";
      inputLabel.className = "block-input-label";
      inputLabel.textContent = "Milliseconds";
      inputLabel.htmlFor = `input-${block.instanceId}`;

      inputNode.className = "block-number-input";
      inputNode.id = `input-${block.instanceId}`;
      inputNode.type = "number";
      inputNode.step = "1";
      inputNode.inputMode = "numeric";
      inputNode.placeholder = "Enter an integer";
      inputNode.value = block.value ?? "";

      inputNode.addEventListener("wheel", (event) => {
        event.preventDefault();
      }, { passive: false });

      inputNode.addEventListener("input", (event) => {
        const cleanedValue = event.target.value.replace(/[^0-9-]/g, "");
        if (cleanedValue !== event.target.value) {
          event.target.value = cleanedValue;
        }

        updateWorkspaceBlockValue(block.instanceId, cleanedValue);
      });

      inputWrap.appendChild(inputLabel);
      inputWrap.appendChild(inputNode);
      blockNode.querySelector(".block-copy").appendChild(inputWrap);
    }
  }

  blockNode.addEventListener("dragstart", (event) => {
    dropHandledInWorkspace = false;
    draggedItem = {
      id: block.id,
      instanceId: block.instanceId ?? null,
      source: context,
      index
    };

    blockNode.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", block.id);
  });

  blockNode.addEventListener("dragend", () => {
    draggedItem = null;
    blockNode.classList.remove("dragging");
    clearDragTargets();
  });

  return blockNode;
}

function renderBank() {
  bankList.innerHTML = "";

  const normalizedSearchQuery = blockSearchQuery.trim().toLowerCase();
  const visibleBlocks = normalizedSearchQuery
    ? initialBlocks.filter((block) => block.title.toLowerCase().includes(normalizedSearchQuery))
    : initialBlocks;

  visibleBlocks.forEach((block) => {
    const blockNode = createBlockNode(block, { context: "bank" });
    bankList.appendChild(blockNode);
  });
}

function renderWorkspace() {
  workspaceList.innerHTML = "";
  workspaceEmpty.hidden = workspaceBlocks.length > 0;

  workspaceBlocks.forEach((block, index) => {
    const blockNode = createBlockNode(block, { context: "workspace", index });

    blockNode.addEventListener("dragover", (event) => {
      event.preventDefault();
      clearDragTargets();
      workspaceDropzone.classList.add("drag-over");
      blockNode.classList.add("drag-target");
      event.dataTransfer.dropEffect = "move";
    });

    blockNode.addEventListener("dragleave", () => {
      blockNode.classList.remove("drag-target");
    });

    blockNode.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearDragTargets();

      if (!draggedItem) {
        return;
      }

      dropHandledInWorkspace = true;

      const dropIndex = Number(blockNode.dataset.index);
      const { top, height } = blockNode.getBoundingClientRect();
      const placeAfter = event.clientY > top + height / 2;

      if (draggedItem.source === "bank") {
        const insertIndex = placeAfter ? dropIndex + 1 : dropIndex;
        addBlockToWorkspace(draggedItem.id, insertIndex);
        return;
      }

      if (draggedItem.source === "workspace") {
        let nextIndex = dropIndex;

        if (draggedItem.index < dropIndex && !placeAfter) {
          nextIndex -= 1;
        }

        if (draggedItem.index > dropIndex && placeAfter) {
          nextIndex += 1;
        }

        moveWorkspaceBlock(draggedItem.index, nextIndex);
      }
    });

    workspaceList.appendChild(blockNode);
  });
}

function render() {
  const previousPositions = captureWorkspacePositions();
  renderBank();
  renderWorkspace();
  updateCount();
  animateWorkspaceTiles(previousPositions);
}

workspaceDropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  workspaceDropzone.classList.add("drag-over");
  event.dataTransfer.dropEffect = "move";
});

workspaceDropzone.addEventListener("dragleave", (event) => {
  if (!workspaceDropzone.contains(event.relatedTarget)) {
    workspaceDropzone.classList.remove("drag-over");
  }
});

workspaceDropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  event.stopPropagation();
  clearDragTargets();

  if (!draggedItem) {
    return;
  }

  dropHandledInWorkspace = true;

  if (draggedItem.source === "bank") {
    addBlockToWorkspace(draggedItem.id);
    return;
  }

  if (draggedItem.source === "workspace") {
    moveWorkspaceBlock(draggedItem.index, workspaceBlocks.length - 1);
  }
});

document.addEventListener("dragover", (event) => {
  if (draggedItem?.source === "workspace" && !workspaceDropzone.contains(event.target)) {
    event.dataTransfer.dropEffect = "move";
  }
});

document.addEventListener("drop", (event) => {
  if (
    draggedItem?.source === "workspace" &&
    !dropHandledInWorkspace &&
    !workspaceDropzone.contains(event.target)
  ) {
    event.preventDefault();
    const instanceId = draggedItem.instanceId;
    draggedItem = null;

    if (instanceId) {
      removeBlockFromWorkspace(instanceId);
    }
  }
});

resetButton.addEventListener("click", () => {
  workspaceBlocks = [];
  if (!isNameLocked) {
    autonomousNameInput.value = "";
  }
  submissionResult.hidden = true;
  render();
});

nameLockButton.addEventListener("click", () => {
  setNameLockState(!isNameLocked);
});

blockSearchInput.addEventListener("input", () => {
  blockSearchQuery = blockSearchInput.value;
  renderBank();
});

saveNewAutoButton.addEventListener("click", loadSavedAutoFromInput);
copyAutoStringButton.addEventListener("click", copyAutoStringToClipboard);

newAutoInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    loadSavedAutoFromInput();
  }
});

editSavedAutosButton.addEventListener("click", () => {
  openSavedAutosModal();
  savedAutos = [];
  renderSavedAutos("Requesting saved autonomous files from the robot...");
  socket.send("Plugin: AutoMaker\nSend saved autos");
  console.log("Requested saved autos");
});

savedAutosBackdrop.addEventListener("click", closeSavedAutosModal);
closeSavedAutosButton.addEventListener("click", closeSavedAutosModal);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !savedAutosModal.hidden) {
    closeSavedAutosModal();
  }
});

startCloseButton.addEventListener("click", () => setStartMode("close"));
startFarButton.addEventListener("click", () => setStartMode("far"));
submitButton.addEventListener("click", submitSequence);

setStartMode(startMode);
setNameLockState(isNameLocked);
render();
