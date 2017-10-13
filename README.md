# Super simple, persistent, no dependency on any db message queue

Have you ever played around with an idea, some side project, and figured out you need a message queue? Maybe you don't want to hassle yourself with an actual message queue, setup Rabbitmq or Kafka, learn about some Redis dependant solution or anything professional as such.

queuelite.js is a super simple, no-server, local, persistent, supports multiple publishers/consumers message queue.

## The gist of it
There is only one queue, there are no channels, exchanges or any kind of higher level abstraction. 

The queue is managed using the file system in a given data directory.

## Why would you need this?
A job queue, or message queue can be extremely useful tools. Whenever a long computational task is composed out of a large number
of small tasks, it can be beneficial to use a queue to manage it. The queue will handle failures, re-tries, distribution of work and other non trivial task.

There are many job/message queue solutions, some dedicated solutions as [RabbitMQ](https://www.rabbitmq.com/), or some db dependant solutions as [kue](https://github.com/Automattic/kue) (Redis)

Queuelite is designed to be as simple to use as possible. It requires no other db, nor any additional setup.

## Example
Suppose we want have a list of 1M file urls that we need to download and do something with. For this task we will create two files: publisher.js, and consumer.js. The publisher will publish messages containing individual files urls, the consumer will be called for each
url and process it.

```javascript
//publisher.js
const queuelite = require('queuelite');

queuelite.connect('./queue_data').then(queue => {
  queue.publish({url: 'http://example.com/file1'});
  queue.publish({url: 'http://example.com/file2'});
  queue.publish({url: 'http://example.com/file3'});
  //...
})
```

```javascript
//consumer.js
const queuelite = require('queuelite');
const request = require('request-promise');

queuelite.connect('./queue_data').then(queue => {
  queue.consume((message) => {
    return request(message.url).then(doSomethingWithFile);
  })
})
```

### Use PM2 to parallelize work
A very useful addition for our solution is the ability to parallelize our work. We can achieve this using the excellent [PM2](https://github.com/Unitech/pm2) process manager. All we need to do is to make it run several consumer.js processes:

``` pm2 start consumer.js -i 12 ```
And just like that we have 12 managed instances of our consumer.

## API
```js
const Queuelite = require('queuelite');
```

### Queuelite.connect
```js
const queue = await Queuelite.connect(dataDirectory)
```
Creates a new instance of queuelite. Returns a promise that resolved to the queue instance
- dataDirectory - directory queuelite stores message files in


### queue.publish
```js
queue.publish(message);
```
Publishes a new message to the job queue. Returns a promise that resolves when publishing is done
- message - plain js object containing message data

### queue.consume
```js
queue.consume((message, metadata /* {tryCount} */) => { 
  // return a promise
});
```
Defines the consumer of the queue. The handler method would be called for each published message.

- message: The plain javascript object published for this message
- metadata:
  - tryCount: number of times this message have been consumed and rejected.

Different processes can define a consumer on the same data directory. Queuelite will try to make sure each message is only consumed by a single process 

consume handler should return a promise:
  - **resolved promise**: indicates that the message was consumed successfully.
  - **rejected promise**: indicates that consuming the message have failed, and you wish to retry consuming it.
  - **rejected promise with Queuelite.ABORT**: indicates that consuming the message have failed, and you do not wish to retry consuming it. The aborted message is stored in an 'abort' directory in the data directory.
