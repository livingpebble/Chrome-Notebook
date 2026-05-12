chrome.runtime.onInstalled.addListener(async () => {
  console.log('QuickNotes extension installed');
  
  const { notes } = await chrome.storage.local.get('notes');
  if (!notes) {
    await chrome.storage.local.set({ notes: [] });
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('QuickNotes extension startup');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getNotes') {
    getNotes().then(sendResponse);
    return true;
  }
  
  if (message.type === 'saveNote') {
    saveNote(message.note).then(sendResponse);
    return true;
  }
  
  if (message.type === 'deleteNote') {
    deleteNote(message.noteId).then(sendResponse);
    return true;
  }
});

async function getNotes() {
  try {
    const { notes } = await chrome.storage.local.get('notes');
    return { success: true, notes: notes || [] };
  } catch (error) {
    console.error('Error getting notes:', error);
    return { success: false, error: error.message };
  }
}

async function saveNote(note) {
  try {
    const { notes } = await chrome.storage.local.get('notes');
    const existingNotes = notes || [];
    
    const noteIndex = existingNotes.findIndex(n => n.id === note.id);
    if (noteIndex >= 0) {
      existingNotes[noteIndex] = {
        ...note,
        updatedAt: Date.now()
      };
    } else {
      existingNotes.unshift({
        ...note,
        id: note.id || Date.now().toString(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    
    await chrome.storage.local.set({ notes: existingNotes });
    return { success: true, notes: existingNotes };
  } catch (error) {
    console.error('Error saving note:', error);
    return { success: false, error: error.message };
  }
}

async function deleteNote(noteId) {
  try {
    const { notes } = await chrome.storage.local.get('notes');
    const existingNotes = notes || [];
    const filteredNotes = existingNotes.filter(n => n.id !== noteId);
    await chrome.storage.local.set({ notes: filteredNotes });
    return { success: true, notes: filteredNotes };
  } catch (error) {
    console.error('Error deleting note:', error);
    return { success: false, error: error.message };
  }
}