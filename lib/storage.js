const fs = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');

class Storage {
  constructor(dataDir, id) {
    this.dataDir = dataDir;
    this.id = id;

    this.workingDir = path.join(this.dataDir, 'working', this.id.toString());
    this.pendingDir = path.join(this.dataDir, 'pending');
  }

  async ensureDataDirs() {
    await fs.mkdirp(this.workingDir);
    await fs.mkdirp(this.pendingDir);
  }

  addNewMessageListener(handler) {
    this.watcher = chokidar.watch(this.pendingDir);

    this.watcher.on('add', filepath => {
      const filename = path.basename(filepath);
      handler(filename);
    });
  }

  async storeMessage(message) {
    const [seconds, nanoSeconds] = process.hrtime();
    const nowNanoSeconds = seconds * 1e9 + nanoSeconds;
    const filePath = path.join(this.pendingDir, `${nowNanoSeconds}`);

    await fs.writeFile(filePath, JSON.stringify(message));
  }

  async getAllMessageIds() {
    const files = await fs.readdir(this.pendingDir);
    return files.map(filename => filename);
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

  async unclaimMesseges() {
    const files = await fs.readdir(this.workingDir);

    return Promise.all(
      files.map(filename => {
        const workingFilepath = this.getWorkingMessagePath(filename);
        const pendingFilepath = this.getMessagePath(filename);

        return fs.rename(workingFilepath, pendingFilepath);
      })
    );
  }

  getMessagePath(messageId) {
    return path.join(this.pendingDir, messageId);
  }

  getWorkingMessagePath(messageId) {
    return path.join(this.workingDir, messageId);
  }
}

module.exports = Storage;
