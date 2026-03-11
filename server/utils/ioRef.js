// Shared Socket.io instance reference — lets adminRoutes emit events
// without circular imports.
let _io = null;

module.exports = {
  setIo: (io) => { _io = io; },
  getIo: () => _io,
};
