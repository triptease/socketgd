# socketgd

Guaranteed delivery for socket.io. Works in node and in the browser.

## Huh?

socketgd is a wrapper around socket.io sockets that provides reliable message delivery. It tracks messages sent
over the socket, and waits for `ack`s to be received from the other end indicating that the messages
were handled successfully.

## Client Usage

```javascript
var SocketGD = require('socketgd').SocketGD;

// in the browser
// <script src="socketgd.js"></script>

// create the socket.io socket
var socket = io(url, config);

// wrap the socket with socketgd
var socketgd = new SocketGD(socket);

// use socketgd instead of the socket
socketgd.on('connect', function() {
  console.log("I'm connected!");
});

socketgd.send('I am sending you a message');
socketgd.emit('your-event', {hi: 'there'});

// ...lets assumes the socket gets disconnected before receiving an ack for 'your-event'
// and we created a new socket...

// set the new socket.
// the un-acked 'your-event' message will be silently sent again
socketgd.setSocket(newSocket);

```


## Server Usage

```javascript
var SocketGD = require('socketgd').SocketGD;
var socketgd = new SocketGD();

// socket.io server
io.on('connection', function(socket) {

  // set the underlying socket in socketgd.
  // if any already acked messages arrive they will be silently discarded
  socketgd.setSocket(socket);

  socketgd.on('message', function(message, ack, msgId) {
    console.log('Got message ' + message + ' with id ' + msgId);
    // finished handling the message, ack it
    ack();
  });

  socketgd.on('my-event', function(data, ack, msgId) {
    console.log('Got my-event ' + data + ' with id ' + msgId);
    // finished handling the event, ack it
    ack();
  });

});
```
## Reconnection

If the underlying socket is configured for auto reconnect then socketgd will automatically send all un-acked messages
to the server whenever the `reconnect` event is fired.

When the server receives messages it has already acked, they will silently be discarded.

## Disconnection

If the underlying socket gets completely disconnected either because reconnect is turned off or socket.io gave up on
reconnection attempts, then the application may create a new socket.io socket and provide it to the same socketgd
instance to continue communication from the point it terminated.

Providing a new socket to a sockgetd instance initiates the same behavior as the `reconnect` event.
See [Reconnection](#reconnection)

#### Server Side Considerations

When a client creates a new socket connection to replace a disconnected one, it's likely that the new socket will
end up connecting to a different server instance than the one the client was previously connected to.
In such cases, a new socketgd wrapper needs to be created in the server, and the `last acked` message id
needs to be set in it.

socketgd's constructor (as well as the method `setLastAcked`) enables setting the last acked message id, so if any
messages arrive multiple times they can be discarded. It's up to the application to share the last ack id
between server instances, such as through redis.

## License

The MIT License (MIT)

Copyright (c) 2015-2016 Capriza Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

