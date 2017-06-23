# WIP

# Super simple, persistent, no dependency on any db message queue

Have you ever played around with an idea, some side project, and figured out you need a message queue? Maybe you don't want to hassle yourself with an actual message queue, setup Rabbitmq or Kafka, learn about some Redis dependant solution or anything professional as such.

queuelite.js is a super simple, no-server, local, persistent, supports multiple publishers/consumers message queue.

## The gist of it
There is only one queue, there are no channels, exchanges or any kind of higher level abstraction. 

The queue is managed using the file system in a given data directory.

## API
```js
const Queuelite = require('queuelite');
```

```js
const queue = await Queuelite.connect(dataDirectory)
```
Creates a new instance of queuelite. Returns a promise that resolved to the queue instance
- dataDirectory - directory queuelite stores message files in


```js
queue.publish(message);
```
Publishes a new message to the job queue. Returns a promise that resolves when promise is done
- message - plain js object containing message data

```js
queue.consume((message) => { 
  // call message.ack() OR
  // message.retry() OR
  // message.reject()
});
```
Defines the consumer of the queue. The handler method would be called for each published message.

Different processes can define a consumer on the same data directory. Queuelite will try to make sure each message is only consumed by a single process 

- message:
  - **body**: the body of the published message
  - **tryCount**: number of times this message have been consumed, and failed using the retry() method.
  - **ack()**: call message.ack() to indicate that the message was consumed successfully.
  - **retry()**: call message.retry() to indicate that consuming the message have failed, and you wish to retry consuming the message.
  - **reject()**: call message.reject() to indicate that consuming the message have failed, and you have no wish to retry consuming the message.