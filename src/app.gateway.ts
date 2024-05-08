import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GomokuGameService, Move, GameResult, Player } from './app.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventGateway implements OnGatewayDisconnect {
  private readonly gomokuGames: Map<string, GomokuGameService>; // Map of room IDs to GomokuGame instances
  private readonly clientIdMapPlayer: Map<string, Player>; // Map of client IDs to player colors
  private readonly clientsRoomMap: Map<string, Array<string>>; // Map of client IDs to GomokuGame instances

  constructor() {
    this.gomokuGames = new Map<string, GomokuGameService>();
    this.clientIdMapPlayer = new Map<string, Player>();
    this.clientsRoomMap = new Map<string, Array<string>>();
  }

  @WebSocketServer() server: Server;

  @SubscribeMessage('joinGame')
  handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    if (!this.gomokuGames.has(roomId)) {
      this.gomokuGames.set(roomId, new GomokuGameService());
    }
    const game = this.gomokuGames.get(roomId);
    let playerColor = Player.Black; // Assign the first player as Black
    if (game.getPlayerCount() === 1) {
      if (game.getRemainingPlayer() === Player.Black) {
        playerColor = Player.White;
      }
    } else if (game.getPlayerCount() > 1) {
      throw new WsException('Room is full.');
    }
    client.join(roomId); // Join the specified room
    if (this.clientsRoomMap.get(client.id)) {
      this.clientsRoomMap.get(client.id).push(roomId);
    } else {
      this.clientsRoomMap.set(client.id, [roomId]);
    }
    game.addPlayer(playerColor);
    this.clientIdMapPlayer.set(client.id, playerColor);
    console.log('client', client.id, 'joined room', roomId, 'as', playerColor);
    this.server.to(roomId).emit('gameState', game.getGameState());
    this.server.to(client.id).emit('joinSuccess', {
      playerColor,
    }); // Send the player color to the client
    return playerColor;
  }

  @SubscribeMessage('makeMove')
  handleMakeMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; move: Move },
  ) {
    const roomId = data.roomId;
    const move = data.move;
    console.log(client.id, 'making move', move, 'in room', roomId);
    const game: GomokuGameService = this.gomokuGames.get(roomId);
    if (game.getCurrentPlayer() !== this.clientIdMapPlayer.get(client.id)) {
      throw new WsException('It is not your turn to make a move.');
    }
    const result: GameResult = game.makeMove(move);
    this.server.to(roomId).emit('gameState', game.getGameState());
    if (result.winner || result.isDraw) {
      this.server.to(roomId).emit('gameResult', result);
    }
  }

  @SubscribeMessage('surrender')
  handleSurrender(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ): void {
    const result: GameResult = this.gomokuGames.get(roomId).surrender();
    this.server.to(roomId).emit('gameResult', result);
  }

  handleDisconnect(client: Socket) {
    // Handle player disconnection as before, but also remove player from their room
    const rooms = this.clientsRoomMap.get(client.id);
    rooms?.forEach((roomId) => {
      if (this.gomokuGames.has(roomId)) {
        const game: GomokuGameService = this.gomokuGames.get(roomId);
        game.removePlayer(this.clientIdMapPlayer.get(client.id));
        console.log('client', client.id, 'left room', roomId);
        if (game.getPlayerCount() === 0) {
          this.gomokuGames.delete(roomId); // Remove the game if there are no players left
        } else if (game.getPlayerCount() === 1) {
          const winner = game.getRemainingPlayer();
          const result: GameResult = {
            winner: winner === Player.Black ? Player.White : Player.Black,
            winPositions: null,
            isDraw: false,
          };
          this.server.to(roomId).emit('gameResult', result);
        }
      }
    });
    this.clientIdMapPlayer.delete(client.id);
    this.clientsRoomMap.delete(client.id);
  }
}
