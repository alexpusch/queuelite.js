const expect = require('chai').expect;
const Promise = require('bluebird');
const fs = require('fs-extra');
const path = require('path');

const Queuelite = require('../lib/queuelite');

const DATA_DIR = '/tmp/testDataDir';
const DATA = { val: 1 };
const DATA2 = { val: 2 };

describe('queuelite', () => {
  beforeEach(async () => {
    await fs.remove(DATA_DIR);
  });

  describe('connect', () => {
    it('creates the data dir directory', async () => {
      await Queuelite.connect(DATA_DIR);
      const pathExists = await fs.pathExists(DATA_DIR);

      expect(pathExists).to.be.true;
    });
  });

  describe('consume', async () => {
    it('works for pushes before consume', async () => {
      const q = await Queuelite.connect(DATA_DIR);
      q.publish(DATA);

      return new Promise((resolve, reject) => {
        q.consume(msg => {
          try {
            expect(msg.body).to.deep.equal(DATA);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
    });

    it('works for pushes after consume', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      const p = new Promise((resolve, reject) => {
        q.consume(msg => {
          try {
            expect(msg.body).to.deep.equal(DATA);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      q.publish(DATA);

      return p;
    });

    it('runs second message after first ack', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      let count = 0;
      const p = new Promise((resolve, reject) => {
        q.consume(msg => {
          try {
            if (count++ === 0) {
              expect(msg.body).to.deep.equal(DATA);
            } else if (count === 1) {
              expect(msg.body).to.deep.equal(DATA2);
            }
            msg.ack();
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      await q.publish(DATA);
      await q.publish(DATA2);

      return p;
    });

    it('runs first message on retry', async () => {
      const q = await Queuelite.connect(DATA_DIR);

      let count = 0;
      const p = new Promise((resolve, reject) => {
        q.consume(msg => {
          try {
            if (count === 0) {
              expect(msg.body).to.deep.equal(DATA);
              msg.retry();
            } else if (count === 1) {
              expect(msg.body).to.deep.equal(DATA);
              msg.ack();
              resolve();
            } else if (count === 2) {
              expect(msg.body).to.deep.equal(DATA2);
              msg.ack();
              resolve();
            }
            count++;
          } catch (e) {
            reject(e);
          }
        });
      });

      await q.publish(DATA);
      await q.publish(DATA2);

      return p;
    });
  });
});
