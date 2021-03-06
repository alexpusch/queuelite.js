const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');

class Storage {
  constructor(dataDir, id) {
    this.dataDir = dataDir;
    this.id = id;

    this.workingDir = path.join(this.dataDir, 'working', this.id.toString());
    this.pendingDir = path.join(this.dataDir, 'pending');
    this.abortDir = path.join(this.dataDir, 'abort');
  }

  async ensureDataDirs() {
    await fs.mkdirp(this.workingDir);
    await fs.mkdirp(this.pendingDir);
    await fs.mkdirp(this.abortDir);
  }

  async getNextMessageId() {
    const files = await fs.readdir(this.pendingDir);

    if (files.length > 0) {
      const nextMessageId = files[0];

      const isClaimedFile = await this.tryClaimMessage(nextMessageId);

      if (isClaimedFile) {
        return nextMessageId;
      }

      return this.getNextMessageId();
    }

    await waitToNewFile(this.pendingDir);
    return this.getNextMessageId();
  }

  async storeMessage(message, options) {
    const [seconds, nanoSeconds] = process.hrtime();
    const nowNanoSeconds = seconds * 1e9 + nanoSeconds;
    const filePath = path.join(this.pendingDir, `${options.priority}_${nowNanoSeconds}`);

    await fs.writeFile(filePath, JSON.stringify(message));
  }

  async getClaimedMessage(messageId) {
    const workingFilepath = this.getWorkingMessagePath(messageId);

    const dataBuffer = await fs.readFile(workingFilepath);
    const data = JSON.parse(dataBuffer.toString());
    return data;
  }

  async deleteClaimedMessage(messageId) {
    const workingFilepath = this.getWorkingMessagePath(messageId);

    await fs.remove(workingFilepath);
  }

  async tryClaimMessage(messageId) {
    const filepath = this.getMessagePath(messageId);

    try {
      const workingFilepath = this.getWorkingMessagePath(messageId);

      await fs.rename(filepath, workingFilepath);
      return true;
    } catch (e) {
      return false;
    }
  }

  async destroy() {
    await this.unclaimMessages();
    await fs.remove(this.workingDir);
  }

  async unclaimMessages() {
    const files = await fs.readdir(this.workingDir);

    return Promise.all(files.map((filename) => {
      const workingFilepath = this.getWorkingMessagePath(filename);
      const pendingFilepath = this.getMessagePath(filename);

      return fs.rename(workingFilepath, pendingFilepath);
    }));
  }

  async moveMessageToAbortDir(messageId) {
    const workingPath = this.getWorkingMessagePath(messageId);
    const abortPath = this.getAbortMessagePath(messageId);

    await fs.rename(workingPath, abortPath);
  }

  getMessagePath(messageId) {
    return path.join(this.pendingDir, messageId);
  }

  getWorkingMessagePath(messageId) {
    return path.join(this.workingDir, messageId);
  }

  getAbortMessagePath(messageId) {
    return path.join(this.abortDir, messageId);
  }
}

function waitToNewFile(dir) {
  const watcher = chokidar.watch(dir);

  return new Promise((resolve) => {
    watcher.on('add', async () => {
      watcher.close();
      resolve();
    });
  });
}
module.exports = Storage;
