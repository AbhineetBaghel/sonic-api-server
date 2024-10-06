const express = require('express');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const anchor = require('@project-serum/anchor');
const app = express();
const fs = require('fs');
const port = 3000;

app.use(express.json());

// Replace with Sonic chain RPC endpoint
const connection = new Connection('https://sonic-rpc-endpoint.example.com');

// Load the IDL (Interface Description Language) for your program
const idl = JSON.parse(fs.readFileSync('./idl.json', 'utf8'));

// Replace with your program ID
const programId = new PublicKey('2gs8GZp9xk1okTQrd1TuzaTycmtVaRffnXu8MQSfmeLW');

// Create a provider
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(Keypair.generate()), {});

// Create a program instance
const program = new anchor.Program(idl, programId, provider);

app.post('/initialize', async (req, res) => {
  try {
    const [globalState, bump] = await PublicKey.findProgramAddress(
      [Buffer.from('global-state')],
      program.programId
    );

    await program.methods
      .initialize(bump)
      .accounts({
        globalState: globalState,
        user: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    res.json({ success: true, message: 'Game initialized' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/create-room', async (req, res) => {
  try {
    const { creatorPublicKey } = req.body;

    const [globalState] = await PublicKey.findProgramAddress(
      [Buffer.from('global-state')],
      program.programId
    );

    const globalStateAccount = await program.account.globalState.fetch(globalState);
    const roomId = globalStateAccount.totalRooms.addn(1);

    const [room] = await PublicKey.findProgramAddress(
      [Buffer.from('room'), roomId.toArrayLike(Buffer, 'le', 8)],
      program.programId
    );

    await program.methods
      .createRoom()
      .accounts({
        room: room,
        globalState: globalState,
        creator: new PublicKey(creatorPublicKey),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    res.json({ success: true, roomId: roomId.toString() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/join-room', async (req, res) => {
  try {
    const { playerPublicKey, roomId } = req.body;

    const [room] = await PublicKey.findProgramAddress(
      [Buffer.from('room'), new anchor.BN(roomId).toArrayLike(Buffer, 'le', 8)],
      program.programId
    );

    await program.methods
      .joinRoom()
      .accounts({
        room: room,
        player: new PublicKey(playerPublicKey),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    res.json({ success: true, message: 'Joined room successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/end-game', async (req, res) => {
  try {
    const { roomId, winnerPublicKey } = req.body;

    const [room] = await PublicKey.findProgramAddress(
      [Buffer.from('room'), new anchor.BN(roomId).toArrayLike(Buffer, 'le', 8)],
      program.programId
    );

    await program.methods
      .endGame(new PublicKey(winnerPublicKey))
      .accounts({
        room: room,
        winner: new PublicKey(winnerPublicKey),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    res.json({ success: true, message: 'Game ended successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/room/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const [room] = await PublicKey.findProgramAddress(
      [Buffer.from('room'), new anchor.BN(roomId).toArrayLike(Buffer, 'le', 8)],
      program.programId
    );

    const roomAccount = await program.account.room.fetch(room);

    res.json({
      success: true,
      roomData: {
        creator: roomAccount.creator.toString(),
        stakingAmount: roomAccount.stakingAmount.toString(),
        players: roomAccount.players.map(p => p.toString()),
        state: roomAccount.state,
        creationTime: roomAccount.creationTime.toString(),
        winner: roomAccount.winner.toString(),
        roomId: roomAccount.roomId.toString(),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});