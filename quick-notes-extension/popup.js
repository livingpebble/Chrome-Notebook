class NoteManager {
  constructor() {
    this.currentEntry = null;
    this.currentContent = '';
    this.autoSaveTimer = null;
    this.notebooksDir = null;
    this.notes = [];
  }

  async init() {
    const result = await chrome.runtime.sendMessage({ type: 'getNotebooksDirectory' });
    
    if (result.success) {
      this.notebooksDir = result.entry;
      await this.retainDirectory(result.entry);
      await this.listNotes();
      await this.openLatestNote();
      return true;
    } else {
      this.showAuthModal();
      return false;
    }
  }

  async retainDirectory(entry) {
    await chrome.runtime.sendMessage({
      type: 'retainEntry',
      entry: entry
    });
  }

  showAuthModal() {
    document.getElementById('authModal').classList.add('show');
    document.getElementById('chooseDirectory').addEventListener('click', async () => {
      const result = await chrome.runtime.sendMessage({ type: 'chooseDirectory' });
      if (result.success) {
        this.notebooksDir = result.entry;
        document.getElementById('authModal').classList.remove('show');
        await this.retainDirectory(result.entry);
        await this.listNotes();
        await this.openLatestNote();
      }
    });
  }

  async listNotes() {
    try {
      const dirReader = this.notebooksDir.createReader();
      const entries = await new Promise((resolve, reject) => {
        dirReader.readEntries(resolve, reject);
      });

      this.notes = [];
      for (const entry of entries) {
        if (entry.isFile && entry.name.endsWith('.txt')) {
          const file = await new Promise((resolve, reject) => {
            entry.file(resolve, reject);
          });
          this.notes.push({
            entry: entry,
            name: entry.name,
            modifiedTime: file.lastModifiedDate,
            size: file.size
          });
        }
      }

      this.notes.sort((a, b) => b.modifiedTime - a.modifiedTime);
      this.renderNotesList();
      return this.notes;
    } catch (error) {
      console.error('Error listing notes:', error);
      this.renderEmptyState('加载笔记列表失败');
      return [];
    }
  }

  renderNotesList(filter = '') {
    const notesList = document.getElementById('notesList');
    
    const filteredNotes = filter 
      ? this.notes.filter(note => note.name.toLowerCase().includes(filter.toLowerCase()))
      : this.notes;

    if (filteredNotes.length === 0) {
      if (filter) {
        notesList.innerHTML = '<div class="empty-state"><p>没有找到匹配的笔记</p></div>';
      } else {
        notesList.innerHTML = '<div class="empty-state"><p>还没有笔记</p><p>点击"新建"创建第一个笔记</p></div>';
      }
      return;
    }

    notesList.innerHTML = filteredNotes.map(note => `
      <div class="note-item ${this.currentEntry && this.currentEntry.name === note.name ? 'active' : ''}" 
           data-name="${note.name}">
        <div class="note-item-title">${this.getDisplayName(note.name)}</div>
        <div class="note-item-time">${this.formatTime(note.modifiedTime)}</div>
      </div>
    `).join('');

    notesList.querySelectorAll('.note-item').forEach(item => {
      item.addEventListener('click', () => {
        const noteName = item.dataset.name;
        const note = this.notes.find(n => n.name === noteName);
        if (note) {
          this.openNote(note.entry);
        }
      });
    });
  }

  renderEmptyState(message = '还没有笔记') {
    const notesList = document.getElementById('notesList');
    notesList.innerHTML = `
      <div class="empty-state">
        <div class="icon">📝</div>
        <p>${message}</p>
        <p>点击"新建"创建第一个笔记</p>
      </div>
    `;
  }

  getDisplayName(filename) {
    return filename.replace('.txt', '');
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) {
      return '刚刚';
    } else if (diff < 3600000) {
      return Math.floor(diff / 60000) + '分钟前';
    } else if (diff < 86400000) {
      return Math.floor(diff / 3600000) + '小时前';
    } else {
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  async openLatestNote() {
    if (this.notes.length > 0) {
      await this.openNote(this.notes[0].entry);
    }
  }

  async openNote(entry) {
    try {
      if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
        await this.saveCurrentNote();
      }

      this.currentEntry = entry;
      const file = await new Promise((resolve, reject) => {
        entry.file(resolve, reject);
      });

      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      this.currentContent = content;
      
      document.getElementById('noteTitle').value = this.getDisplayName(entry.name);
      document.getElementById('noteEditor').value = content;
      document.getElementById('currentFile').textContent = entry.name;
      document.getElementById('lastModified').textContent = this.formatTime(file.lastModifiedDate);
      this.updateCharCount();
      this.updateSaveStatus('saved');
      
      this.renderNotesList();
      
      await chrome.runtime.sendMessage({
        type: 'retainEntry',
        entry: entry
      });

    } catch (error) {
      console.error('Error opening note:', error);
      this.updateSaveStatus('error');
    }
  }

  async createNote(filename) {
    if (!this.notebooksDir) {
      console.error('Notebooks directory not initialized');
      return false;
    }

    try {
      let noteName = filename;
      if (!noteName.endsWith('.txt')) {
        noteName += '.txt';
      }

      const existingNote = this.notes.find(n => n.name === noteName);
      if (existingNote) {
        alert('文件名已存在，请使用其他名称');
        return false;
      }

      const entry = await new Promise((resolve, reject) => {
        this.notebooksDir.getFile(noteName, { create: true, exclusive: true }, resolve, reject);
      });

      const writable = await new Promise((resolve, reject) => {
        entry.createWriter(resolve, reject);
      });

      writable.onwriteend = async () => {
        await this.retainEntry(entry);
        await this.listNotes();
        await this.openNote(entry);
      };

      writable.write(new Blob([''], { type: 'text/plain' }));
      return true;

    } catch (error) {
      console.error('Error creating note:', error);
      return false;
    }
  }

  async retainEntry(entry) {
    await chrome.runtime.sendMessage({
      type: 'retainEntry',
      entry: entry
    });
  }

  async saveCurrentNote() {
    if (!this.currentEntry) {
      return false;
    }

    try {
      this.updateSaveStatus('saving');
      
      const content = document.getElementById('noteEditor').value;
      
      const writable = await new Promise((resolve, reject) => {
        this.currentEntry.createWriter(resolve, reject);
      });

      return await new Promise((resolve, reject) => {
        writable.onwriteend = () => {
          this.currentContent = content;
          this.updateSaveStatus('saved');
          resolve(true);
        };
        
        writable.onerror = (error) => {
          this.updateSaveStatus('error');
          reject(error);
        };

        writable.write(new Blob([content], { type: 'text/plain' }));
      });

    } catch (error) {
      console.error('Error saving note:', error);
      this.updateSaveStatus('error');
      return false;
    }
  }

  async deleteNote() {
    if (!this.currentEntry) {
      return false;
    }

    try {
      await new Promise((resolve, reject) => {
        this.currentEntry.remove(resolve, reject);
      });

      this.currentEntry = null;
      this.currentContent = '';
      document.getElementById('noteTitle').value = '';
      document.getElementById('noteEditor').value = '';
      document.getElementById('currentFile').textContent = '未选择文件';
      document.getElementById('lastModified').textContent = '-';
      this.updateCharCount();
      this.updateSaveStatus('saved');

      await this.listNotes();
      
      if (this.notes.length > 0) {
        await this.openLatestNote();
      }

      return true;
    } catch (error) {
      console.error('Error deleting note:', error);
      return false;
    }
  }

  updateCharCount() {
    const content = document.getElementById('noteEditor').value;
    const count = content.length;
    document.getElementById('charCount').textContent = `${count} 字符`;
  }

  updateSaveStatus(status) {
    const statusEl = document.getElementById('saveStatus');
    const statusTextEl = statusEl.querySelector('.status-text');
    
    statusEl.className = 'save-status';
    
    switch (status) {
      case 'saving':
        statusEl.classList.add('saving');
        statusTextEl.textContent = '保存中...';
        break;
      case 'saved':
        statusEl.classList.add('saved');
        statusTextEl.textContent = '已保存';
        break;
      case 'error':
        statusEl.classList.add('error');
        statusTextEl.textContent = '保存失败';
        break;
      case 'pending':
        statusEl.classList.add('saving');
        statusTextEl.textContent = '等待输入';
        break;
    }
  }

  scheduleAutoSave() {
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }

    const currentContent = document.getElementById('noteEditor').value;
    
    if (currentContent !== this.currentContent) {
      this.updateSaveStatus('pending');
      
      this.autoSaveTimer = setTimeout(async () => {
        await this.saveCurrentNote();
        await this.listNotes();
      }, 1500);
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const noteManager = new NoteManager();
  await noteManager.init();

  const editor = document.getElementById('noteEditor');
  editor.addEventListener('input', () => {
    noteManager.scheduleAutoSave();
    noteManager.updateCharCount();
  });

  document.getElementById('newNoteBtn').addEventListener('click', () => {
    document.getElementById('newNoteModal').classList.add('show');
    document.getElementById('newNoteName').value = '';
    document.getElementById('newNoteName').focus();
  });

  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('newNoteModal').classList.remove('show');
  });

  document.getElementById('cancelNewNote').addEventListener('click', () => {
    document.getElementById('newNoteModal').classList.remove('show');
  });

  document.getElementById('confirmNewNote').addEventListener('click', async () => {
    const filename = document.getElementById('newNoteName').value.trim();
    
    if (!filename) {
      alert('请输入文件名');
      return;
    }

    const success = await noteManager.createNote(filename);
    if (success) {
      document.getElementById('newNoteModal').classList.remove('show');
    }
  });

  document.getElementById('newNoteName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('confirmNewNote').click();
    }
  });

  document.getElementById('saveBtn').addEventListener('click', async () => {
    await noteManager.saveCurrentNote();
    await noteManager.listNotes();
  });

  document.getElementById('deleteBtn').addEventListener('click', () => {
    if (noteManager.currentEntry) {
      document.getElementById('deleteModal').classList.add('show');
    }
  });

  document.getElementById('closeDeleteModal').addEventListener('click', () => {
    document.getElementById('deleteModal').classList.remove('show');
  });

  document.getElementById('cancelDelete').addEventListener('click', () => {
    document.getElementById('deleteModal').classList.remove('show');
  });

  document.getElementById('confirmDelete').addEventListener('click', async () => {
    const success = await noteManager.deleteNote();
    document.getElementById('deleteModal').classList.remove('show');
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    noteManager.renderNotesList(e.target.value);
  });

  document.getElementById('searchBtn').addEventListener('click', () => {
    const searchTerm = document.getElementById('searchInput').value;
    noteManager.renderNotesList(searchTerm);
  });

  document.getElementById('refreshBtn').addEventListener('click', async () => {
    await noteManager.listNotes();
  });

  document.getElementById('toggleSidebar').addEventListener('click', () => {
    const sidebar = document.querySelector('.notes-sidebar');
    sidebar.classList.toggle('collapsed');
    const btn = document.getElementById('toggleSidebar');
    btn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
    btn.title = sidebar.classList.contains('collapsed') ? '展开' : '收起';
  });

  window.addEventListener('beforeunload', async () => {
    if (noteManager.autoSaveTimer) {
      clearTimeout(noteManager.autoSaveTimer);
      await noteManager.saveCurrentNote();
    }
  });
});
