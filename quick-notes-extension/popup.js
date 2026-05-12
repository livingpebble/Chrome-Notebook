class NoteManager {
  constructor() {
    this.currentNote = null;
    this.currentContent = '';
    this.autoSaveTimer = null;
    this.notes = [];
  }

  async init() {
    await this.listNotes();
    await this.openLatestNote();
    return true;
  }

  async listNotes() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'getNotes' });
      
      if (result.success) {
        this.notes = result.notes.sort((a, b) => b.updatedAt - a.updatedAt);
        this.renderNotesList();
        return this.notes;
      } else {
        this.notes = [];
        this.renderEmptyState('加载笔记列表失败');
        return [];
      }
    } catch (error) {
      console.error('Error listing notes:', error);
      this.renderEmptyState('加载笔记列表失败');
      return [];
    }
  }

  renderNotesList(filter = '') {
    const notesList = document.getElementById('notesList');
    
    const filteredNotes = filter 
      ? this.notes.filter(note => note.title.toLowerCase().includes(filter.toLowerCase()))
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
      <div class="note-item ${this.currentNote && this.currentNote.id === note.id ? 'active' : ''}" 
           data-id="${note.id}">
        <div class="note-item-title">${note.title}</div>
        <div class="note-item-time">${this.formatTime(note.updatedAt)}</div>
      </div>
    `).join('');

    notesList.querySelectorAll('.note-item').forEach(item => {
      item.addEventListener('click', () => {
        const noteId = item.dataset.id;
        const note = this.notes.find(n => n.id === noteId);
        if (note) {
          this.openNote(note);
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
      await this.openNote(this.notes[0]);
    }
  }

  async openNote(note) {
    try {
      if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
        await this.saveCurrentNote();
      }

      this.currentNote = note;
      this.currentContent = note.content;
      
      document.getElementById('noteTitle').value = note.title;
      document.getElementById('noteEditor').value = note.content;
      document.getElementById('currentFile').textContent = note.title + '.txt';
      document.getElementById('lastModified').textContent = this.formatTime(note.updatedAt);
      this.updateCharCount();
      this.updateSaveStatus('saved');
      
      this.renderNotesList();

    } catch (error) {
      console.error('Error opening note:', error);
      this.updateSaveStatus('error');
    }
  }

  async createNote(title) {
    try {
      if (!title.trim()) {
        alert('请输入文件名');
        return false;
      }

      const existingNote = this.notes.find(n => n.title === title.trim());
      if (existingNote) {
        alert('文件名已存在，请使用其他名称');
        return false;
      }

      const newNote = {
        id: Date.now().toString(),
        title: title.trim(),
        content: ''
      };

      const result = await chrome.runtime.sendMessage({ type: 'saveNote', note: newNote });
      
      if (result.success) {
        this.notes = result.notes;
        await this.openNote(newNote);
        return true;
      } else {
        return false;
      }

    } catch (error) {
      console.error('Error creating note:', error);
      return false;
    }
  }

  async saveCurrentNote() {
    if (!this.currentNote) {
      return false;
    }

    try {
      this.updateSaveStatus('saving');
      
      const title = document.getElementById('noteTitle').value.trim();
      const content = document.getElementById('noteEditor').value;

      if (!title) {
        alert('请输入笔记标题');
        this.updateSaveStatus('error');
        return false;
      }

      const note = {
        ...this.currentNote,
        title: title,
        content: content
      };

      const result = await chrome.runtime.sendMessage({ type: 'saveNote', note: note });
      
      if (result.success) {
        this.currentNote = note;
        this.currentContent = content;
        this.notes = result.notes;
        this.updateSaveStatus('saved');
        document.getElementById('currentFile').textContent = title + '.txt';
        await this.listNotes();
        return true;
      } else {
        this.updateSaveStatus('error');
        return false;
      }

    } catch (error) {
      console.error('Error saving note:', error);
      this.updateSaveStatus('error');
      return false;
    }
  }

  async deleteNote() {
    if (!this.currentNote) {
      return false;
    }

    try {
      const result = await chrome.runtime.sendMessage({ type: 'deleteNote', noteId: this.currentNote.id });
      
      if (result.success) {
        this.currentNote = null;
        this.currentContent = '';
        document.getElementById('noteTitle').value = '';
        document.getElementById('noteEditor').value = '';
        document.getElementById('currentFile').textContent = '未选择文件';
        document.getElementById('lastModified').textContent = '-';
        this.updateCharCount();
        this.updateSaveStatus('saved');

        this.notes = result.notes;
        await this.listNotes();
        
        if (this.notes.length > 0) {
          await this.openLatestNote();
        }

        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      return false;
    }
  }

  async exportNotes() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'getNotes' });
      
      if (!result.success || !result.notes || result.notes.length === 0) {
        alert('没有笔记可导出');
        return false;
      }

      for (const note of result.notes) {
        const fileName = `${note.title || 'untitled'}.txt`;
        const safeFileName = fileName.replace(/[<>:"/\\|?*]/g, '_');
        const blob = new Blob([note.content || ''], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      const metaBlob = new Blob([JSON.stringify(result.notes, null, 2)], { type: 'application/json' });
      const metaUrl = URL.createObjectURL(metaBlob);
      const metaLink = document.createElement('a');
      metaLink.href = metaUrl;
      metaLink.download = 'notes_meta.json';
      document.body.appendChild(metaLink);
      metaLink.click();
      document.body.removeChild(metaLink);
      URL.revokeObjectURL(metaUrl);

      alert(`成功导出 ${result.notes.length} 条笔记和元数据文件`);
      return true;
    } catch (error) {
      console.error('Error exporting notes:', error);
      alert('导出失败: ' + error.message);
      return false;
    }
  }

  async importNotes() {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.txt';
      
      const files = await new Promise((resolve) => {
        input.onchange = () => resolve(Array.from(input.files));
        input.click();
      });

      if (!files || files.length === 0) {
        return false;
      }

      let importedCount = 0;
      let skippedCount = 0;

      for (const file of files) {
        if (file.name.endsWith('.txt')) {
          try {
            const content = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target.result);
              reader.onerror = reject;
              reader.readAsText(file);
            });

            const title = file.name.replace('.txt', '');

            const existingNote = this.notes.find(n => n.title === title);
            if (existingNote) {
              const confirmOverwrite = confirm(`笔记 "${title}" 已存在，是否覆盖？`);
              if (!confirmOverwrite) {
                skippedCount++;
                continue;
              }
              const note = {
                ...existingNote,
                content: content,
                updatedAt: Date.now()
              };
              await chrome.runtime.sendMessage({ type: 'saveNote', note: note });
            } else {
              const newNote = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                title: title,
                content: content,
                createdAt: Date.now(),
                updatedAt: Date.now()
              };
              await chrome.runtime.sendMessage({ type: 'saveNote', note: newNote });
            }
            importedCount++;
          } catch (error) {
            console.error('Error importing file:', file.name, error);
          }
        }
      }

      await this.listNotes();
      
      let message = '';
      if (importedCount > 0) {
        message += `成功导入 ${importedCount} 条笔记`;
      }
      if (skippedCount > 0) {
        message += (message ? '\n' : '') + `跳过 ${skippedCount} 条已存在的笔记`;
      }
      if (importedCount === 0 && skippedCount === 0) {
        message = '没有找到可导入的笔记文件';
      }
      
      alert(message);
      return true;
    } catch (error) {
      console.error('Error importing notes:', error);
      alert('导入失败: ' + error.message);
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
  });

  document.getElementById('deleteBtn').addEventListener('click', () => {
    if (noteManager.currentNote) {
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

  document.getElementById('exportBtn').addEventListener('click', async () => {
    await noteManager.exportNotes();
  });

  document.getElementById('importBtn').addEventListener('click', async () => {
    await noteManager.importNotes();
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