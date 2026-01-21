const Turn = require('node-turn');

// Define the TURN server configuration
// This acts as the "Proxy Connection IP" protocol handler
const server = new Turn({
    // 'long-term' authentication mechanism is standard for WebRTC
    authMech: 'long-term',

    // Credentials for the TURN server
    // In a production environment, you should manage these dynamically or use environment variables
    credentials: {
        username: "password"
    },

    // Port to listen on (Standard TURN port)
    listeningPort: 3478,

    // Relay IPs: IMPORTANT
    // If running behind NAT (like on AWS EC2 or home router), you might need to specify external IP
    // externalIps: ['YOUR_PUBLIC_IP'], 

    // Debug level
    // debugLevel: 'DEBUG'
});

server.start();
console.log('---------------------------------------------------------');
console.log('SELF-HOSTED PROXY PROTOCOL (TURN SERVER) STARTED');
console.log('Listening on Port: 3478');
console.log('Authentication: username="username", password="password"');
console.log('---------------------------------------------------------');
console.log('Ensure this port (3478 TCP/UDP) is open in your firewall.');
console.log('---------------------------------------------------------');
