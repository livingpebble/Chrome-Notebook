let retainedEntries = [];

chrome.runtime.onInstalled.addListener(() => {
  console.log('QuickNotes extension installed');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('QuickNotes extension startup');
  restoreRetainedEntries();
});

chrome.fileSystem.onRestored.addListener(() => {
  console.log('File system access restored');
  restoreRetainedEntries();
});

async function restoreRetainedEntries() {
  const { retainedEntries: storedEntries } = await chrome.storage.local.get('retainedEntries');
  if (storedEntries && storedEntries.length > 0) {
    try {
      const entries = await chrome.fileSystem.restoreEntries(storedEntries);
      retainedEntries = entries;
      console.log('Restored', entries.length, 'file entries');
    } catch (error) {
      console.error('Failed to restore entries:', error);
      retainedEntries = [];
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getNotebooksDirectory') {
    getNotebooksDirectory().then(sendResponse);
    return true;
  }
  
  if (message.type === 'retainEntry') {
    retainEntry(message.entry).then(sendResponse);
    return true;
  }
  
  if (message.type === 'chooseDirectory') {
    chooseDirectory().then(sendResponse);
    return true;
  }
});

async function getNotebooksDirectory() {
  try {
    const { notebooksEntry } = await chrome.storage.local.get('notebooksEntry');
    
    if (notebooksEntry) {
      try {
        const entry = await chrome.fileSystem.restoreEntry(notebooksEntry.id, notebooksEntry.readable);
        const writableEntry = await chrome.fileSystem.restoreEntry(notebooksEntry.id, notebooksEntry.writable);
        
        const dirReader = entry.createReader();
        const entries = await new Promise((resolve, reject) => {
          dirReader.readEntries(resolve, reject);
        });
        
        return { success: true, entry: writableEntry || entry, isNew: false };
      } catch (error) {
        console.log('Stored entry no longer accessible, need to re-choose');
      }
    }
    
    return await chooseDirectory();
  } catch (error) {
    console.error('Error getting notebooks directory:', error);
    return { success: false, error: error.message };
  }
}

async function chooseDirectory() {
  try {
    const entry = await chrome.fileSystem.chooseEntry({
      type: 'openDirectory',
      acceptsMultiple: false
    });
    
    if (entry) {
      const writableEntry = await chrome.fileSystem.retainEntry(entry);
      
      await chrome.storage.local.set({
        notebooksEntry: {
          id: writableEntry.id,
          readable: true,
          writable: true
        },
        retainedEntries: [...retainedEntries.map(e => ({ id: e.id, readable: true, writable: true })), {
          id: writableEntry.id,
          readable: true,
          writable: true
        }]
      });
      
      retainedEntries.push(entry);
      
      return { success: true, entry: entry, isNew: true };
    }
    
    return { success: false, error: 'No directory selected' };
  } catch (error) {
    console.error('Error choosing directory:', error);
    return { success: false, error: error.message };
  }
}

async function retainEntry(entry) {
  try {
    const writableEntry = await chrome.fileSystem.retainEntry(entry);
    retainedEntries.push(entry);
    
    const { retainedEntries: storedEntries } = await chrome.storage.local.get('retainedEntries');
    const newStoredEntries = storedEntries || [];
    newStoredEntries.push({
      id: writableEntry.id,
      readable: true,
      writable: true
    });
    
    await chrome.storage.local.set({ retainedEntries: newStoredEntries });
    
    return { success: true };
  } catch (error) {
    console.error('Error retaining entry:', error);
    return { success: false, error: error.message };
  }
}
