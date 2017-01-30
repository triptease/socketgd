var uuid = require('uuid/v4');

(function(exporter) {

  /**
   * socket.io guaranteed delivery socket wrapper.
   * if the socket gets disconnected at any point, it's up to the application to set a new socket to continue
   * handling messages.
   * calling 'setSocket' causes all messages that have not received an ack to be sent again.
   * @constructor
   */
  function SocketGD(socket, options) {
    this._pending = {};
    this._events = {};
    this._enabled = true;
    this._onAckCB = SocketGD.prototype._onAck.bind(this);
    this._onReconnectCB = SocketGD.prototype._onReconnect.bind(this);
    this._autoAck = options && options.autoAck || false;
    this.setSocket(socket);
    this._ackMap = {};
  }

  /**
   * replace the underlying socket.io socket with a new socket. useful in case of a socket getting
   * disconnected and a new socket is used to continue with the communications
   * @param socket
   */
  SocketGD.prototype.setSocket = function(socket) {

    this._cleanup();
    this._socket = socket;

    if (this._socket) {
      this._socket.on('reconnect', this._onReconnectCB);
      this._socket.on('socketgd_ack', this._onAckCB);

      this.sendPending();
    }
  };

  /**
   * send all pending messages that have not received an ack
   */
  SocketGD.prototype.sendPending = function() {
    // send all pending messages that haven't been acked yet
    let msgId;
    for (msgId in this._pending) {
      let message = this._pending[msgId];
      this._sendOnSocket(message);
    }
  };

  /**
   * clear out any pending messages
   */
  SocketGD.prototype.clearPending = function() {
    this._pending = {};
  };

  /**
   * enable or disable sending message with gd. if disabled, then messages will be sent without guaranteeing delivery
   * in case of socket disconnection/reconnection.
   */
  SocketGD.prototype.enable = function(enabled) {
    this._enabled = enabled;
  };

  /**
   * get the underlying socket
   */
  SocketGD.prototype.socket = function() {
    return this._socket;
  };

  /**
   * cleanup socket stuff
   * @private
   */
  SocketGD.prototype._cleanup = function() {
    if (!this._socket) {
      return;
    }

    this._socket.removeListener('reconnect', this._onReconnectCB);
    this._socket.removeListener('socketgd_ack', this._onAckCB);
  };

  /**
   * invoked when an ack arrives
   * @param ack
   * @private
   */
  SocketGD.prototype._onAck = function(ack) {
    if (ack.id in this._pending) {
      const pending = this._pending[ack.id];
      delete this._pending[ack.id];
      if (pending.ack) {
        pending.ack.call(null, ack.data);
      }
    }
  };

  /**
   * invoked when an a reconnect event occurs on the underlying socket
   * @private
   */
  SocketGD.prototype._onReconnect = function() {
    this.sendPending();
  };

  /**
   * send an ack for a message
   * @private
   */
  SocketGD.prototype._sendAck = function(id, data) {
    if (!this._socket) {
      return;
    }

    this._ackMap[id] = true;
    this._socket.emit('socketgd_ack', {id: id, data: data});
    return id;
  };

  /**
   * send a message on the underlying socket.io socket
   * @param message
   * @private
   */
  SocketGD.prototype._sendOnSocket = function(message) {
    if (this._enabled && message.id === undefined) {
      message.id = uuid();
      message.gd = true;
      this._pending[message.id] = message;
    }

    if (!this._socket) {
      return;
    }

    if (this._enabled) {
      this._socket.emit(message.event, {socketgd: message.id, msg: message.msg});
    } else {
      this._socket.emit(message.event, message.msg, message.ack);
    }
  };

  /**
   * emit an event with gd. this means that if an ack is not received and a new connection is established (by
   * calling setSocket), the event will be emitted again.
   * @param event
   * @param message
   * @param ack
   */
  SocketGD.prototype.emit = function(event, message, ack) {
    this._sendOnSocket({event: event, msg: message, ack: ack});
  };

  /**
   * disconnect the socket
   */
  SocketGD.prototype.disconnect = function(close) {
    this._socket && this._socket.disconnect(close);
    this._cleanup();
    this._socket = null;
  };

  /**
   * disconnectSync the socket
   */
  SocketGD.prototype.disconnectSync = function() {
    this._socket && this._socket.disconnectSync();
    this._cleanup();
    this._socket = null;
  };

  /**
   * close the socket
   */
  SocketGD.prototype.close = function() {
    this._socket && this._socket.disconnect(true);
    this._cleanup();
    this._socket = null;
  };

  /**
   * listen for events on the socket. this replaces calling the 'on' method directly on the socket.io socket.
   * here we take care of acking messages.
   * @param event
   * @param cb
   */
  SocketGD.prototype.on = function(event, cb) {
    this._events[event] = this._events[event] || [];

    var _this = this;
    var cbData = {
      cb: cb,
      wrapped: function(data, ack) {
        if (data && typeof data === 'object' && data.socketgd !== undefined) {
          if (data.socketgd in _this._ackMap) {
            // discard the message since it was already handled and acked
            return;
          }
          var sendAck = function(ackData) {
            return _this._sendAck(data.socketgd, ackData);
          };
          cb && cb(data.msg, sendAck, data.socketgd);
          if (_this._autoAck) sendAck();
        } else {
          cb(data, ack);
        }
      }
    };

    this._events[event].push(cbData);

    this._socket.on(event, cbData.wrapped);
  };

  /**
   * remove a previously set callback for the specified event
   */
  SocketGD.prototype.off =
      SocketGD.prototype.removeListener = function(event, cb) {
        if (!this._events[event]) {
          return;
        }

        // find the callback to remove
        for (var i = 0; i < this._events[event].length; ++i) {
          if (this._events[event][i].cb === cb) {
            this._socket && this._socket.removeListener(event, this._events[event][i].wrapped);
            this._events[event].splice(i, 1);
          }
        }
      };

  exporter.SocketGD = SocketGD;

})(typeof module !== 'undefined' && typeof module.exports === 'object' ? module.exports : window);
