var should = require('should');
var http = require('http');
var ios = require('socket.io');
var ioc = require('socket.io-client');
var SocketGD = require('./socketgd').SocketGD;

var port = 10101;
var app;
var ioserver;

function client(of, cb) {
  var socketgd = new SocketGD(ioc('http://localhost:'+port+of));
  socketgd.on('connect', function() {
    cb && cb(socketgd);
    cb = null;
  });
  return socketgd;
}

describe('Socket GD', function() {

  before(function(done) {
    app = http.createServer();
    ioserver = ios(app);
    app.listen(port, done);
  });

  beforeEach(function(done) {
    done();
  });

  afterEach(function(done) {
    done();
  });

  it('sends and receives messages normally', function(done) {
    var events = 0;
    var ssgd = new SocketGD();
    ioserver.of('/1').on('connection', function(socket) {
      ssgd.setSocket(socket);
      ssgd.on('message', function(message) {
        ++events;
        message.should.be.exactly('hello server');
      });
      ssgd.on('event1', function(event) {
        ++events;
        event.hello.should.be.exactly('world');
        event.number.should.be.exactly(1);
        event.boolean.should.be.exactly(true);
        ssgd.send('hello client');
        ssgd.emit('event1', {hello: 'world', number: 1, boolean: true});
        ssgd.emit('event2', {hello2: 'world2'});
      });
      ssgd.on('event2', function(event) {
        ++events;
        event.hello2.should.be.exactly('world2');
      });
    });

    var csgd = new SocketGD(ioc('http://localhost:'+port+'/1', {transports: ['websocket'], forceNew: true}));
    csgd.on('connect', function() {
      csgd.send('hello server');
      csgd.emit('event1', {hello: 'world', number: 1, boolean: true});
      csgd.emit('event2', {hello2: 'world2'});
    });
    csgd.on('message', function(message) {
      ++events;
      message.should.be.exactly('hello client');
    });
    csgd.on('event1', function(event) {
      ++events;
      event.hello.should.be.exactly('world');
      event.number.should.be.exactly(1);
      event.boolean.should.be.exactly(true);
    });
    csgd.on('event2', function(event) {
      ++events;
      event.hello2.should.be.exactly('world2');
      events.should.be.exactly(6);
      done();
    });
  });

  it('sends and receives messages after disconnect', function(done) {
    var sevents = 0;
    var cevents = 0;
    var ssgd = new SocketGD();
    ioserver.of('/2').on('connection', function(socket) {
      ssgd.setSocket(socket);
      ssgd.on('message', function(message, ack) {
        ack();
        ++sevents;
        ssgd.send(message);
        if (sevents === 1) {
          // terminate the socket after the first message
          ssgd.disconnect(true);
        }
      });
    });

    var csgd = new SocketGD(ioc('http://localhost:'+port+'/2', {transports: ['websocket'], forceNew: true}));

    var sendMessages = function() {
      csgd.send('hello server 1');
      csgd.send('hello server 2');
      csgd.send('hello server 3');
      sendMessages = null;
    };

    csgd.on('connect', function() {
      sendMessages && sendMessages();
    });
    csgd.on('message', function(message, ack, msgId) {
      ++cevents;
      if (msgId === 2) {
        sevents.should.be.exactly(3);
        cevents.should.be.exactly(3);
        done();
      }
    });
  });
});