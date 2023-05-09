

class Session {

   static _sessions = new Map();

   static _generateOneIdentifier(providerId='', consumerId='') {
      return `${providerId}__${consumerId}`
   }

   /**
    * Get session by consumer and provider ids, if not available, it's created
    * @param {String} providerId Service provider identifier
    * @param {String} customerId Service consumer identifier
    * @returns {Session}
    */
   static getSession(providerId, consumerId) {

      const id = this._generateOneIdentifier(providerId, consumerId);
      let session = this._sessions.get(id);

      if (!session) {
         session = new Session(id);
         this._sessions.set(id, session);
      }

      return session;
   }

   /**
    * Remove all sessions
    */
   static clearSessions() {
      this._sessions.clear();
   }

   static deleteSession(providerId, consumerId) {
      const key = this._generateOneIdentifier(providerId, consumerId)
      this._sessions.delete(key);
   }


   /**
    * @param {Function} processor A function that accepts providerId, consumerId, state, the message, and session data. It then returns the the new state and the response in this format: [ newState, response, sessionDataUpdates ]
    * @returns {Session}
    */
   static setProcessor(processor) {

      if (typeof processor !== 'function')
         throw new Error('Processor should be a function');

      this._processor = processor;
   }

   /**
    * @returns {Function}
    */
   static getProcessor() {
      return this._processor;
   }


   /**
    * @param {String} state The state of this session
    * @returns {String}
    */
   setState(state) {
      this._state = state;
   }

   /**
    * Returns the state of the session
    * @returns {String}
    */
   getState() {
      return this._state;
   }
   

   /**
    * @param {String} providerId Service provider identifier
    * @param {String} consumerId Service consumer identifier
    * @param {String} payload The message from the user
    * @returns {Promise<Any>}
    */
   static async processRequest(providerId, consumerId, payload) {

      const processor = this.getProcessor();


      if (!processor)
         throw new Error('Processor not set');

      const session = Session.getSession(providerId, consumerId);
      const state = session.getState();

      const [ newState, response, sessionDataUpdates ] = await processor(providerId, consumerId, state, payload, session._sessionData);
      session._updateSessionData(sessionDataUpdates);
      session.setState(newState);

      if (!newState)
         this.deleteSession(providerId, consumerId);


      return response;
      
   } 

   _updateSessionData(updates={}) {
      this._sessionData = { ...this._sessionData, ...updates };
   }



   /**
    * @param {String} providerId Service provider identifier
    * @param {String} consumerId Service consumer identifier
    */
   constructor(providerId, consumerId) {
      this._id = providerId;
      this._consumerId = consumerId;
      this._sessionData = {}
   }
}


module.exports = Session;