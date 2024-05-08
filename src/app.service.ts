import { Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

const BOARD_SIZE = 15; // Size of the game board

export enum Player {
  None = 0,
  Black = 1,
  White = 2,
}

export interface Move {
  x: number;
  y: number;
}

export interface GameResult {
  winner: Player | null;
  winPositions: Move[] | null;
  isDraw: boolean;
}
@Injectable()
export class GomokuGameService {
  private board: Player[][];
  private players: Set<Player>; // Track connected players
  private currentPlayer: Player;
  private gameOver: boolean;
  private disconnectTimer: NodeJS.Timer | null;
  private readonly disconnectTimeout = 60000; // 1 minute in milliseconds

  constructor() {
    this.board = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      this.board[i] = [];
      for (let j = 0; j < BOARD_SIZE; j++) {
        this.board[i][j] = Player.None;
      }
    }
    this.currentPlayer = Player.Black; // Black starts first
    this.gameOver = false;
    this.players = new Set<Player>();
    this.disconnectTimer = null;
  }

  getGameState(): {
    board: Player[][];
    currentPlayer: Player;
    playerCount: number;
    players: Player[];
  } {
    return {
      board: this.board,
      currentPlayer: this.currentPlayer,
      playerCount: this.players.size,
      players: [...this.players],
    };
  }

  makeMove(move: Move): GameResult {
    if (this.gameOver || this.board[move.x][move.y] !== Player.None) {
      throw new WsException('Invalid move');
    }

    this.board[move.x][move.y] = this.currentPlayer;

    const result = this.checkForWin(move);

    if (result.winner) {
      this.gameOver = true;
    } else if (this.isBoardFull()) {
      result.isDraw = true;
      this.gameOver = true;
    } else {
      this.currentPlayer =
        this.currentPlayer === Player.Black ? Player.White : Player.Black;
    }

    return result;
  }

  private isBoardFull(): boolean {
    for (const row of this.board) {
      for (const cell of row) {
        if (cell === Player.None) {
          return false;
        }
      }
    }
    return true;
  }

  private checkForWin(move: Move): GameResult {
    const directions = [
      { dx: 1, dy: 0 }, // Horizontal
      { dx: 0, dy: 1 }, // Vertical
      { dx: 1, dy: 1 }, // Diagonal (top-left to bottom-right)
      { dx: 1, dy: -1 }, // Diagonal (top-right to bottom-left)
    ];

    for (const dir of directions) {
      const count =
        this.countConsecutive(move, dir.dx, dir.dy) +
        this.countConsecutive(move, -dir.dx, -dir.dy) +
        1;
      if (count >= 5) {
        const winPositions = [move];
        for (let i = 1; i < 5; i++) {
          winPositions.push({ x: move.x + i * dir.dx, y: move.y + i * dir.dy });
        }
        return { winner: this.currentPlayer, winPositions, isDraw: false };
      }
    }

    return { winner: null, winPositions: null, isDraw: false };
  }

  private countConsecutive(move: Move, dx: number, dy: number): number {
    let x = move.x + dx;
    let y = move.y + dy;
    let count = 0;
    while (
      x >= 0 &&
      x < BOARD_SIZE &&
      y >= 0 &&
      y < BOARD_SIZE &&
      this.board[x][y] === this.currentPlayer
    ) {
      count++;
      x += dx;
      y += dy;
    }
    return count;
  }

  getBoard(): Player[][] {
    return this.board;
  }

  getCurrentPlayer(): Player {
    return this.currentPlayer;
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  surrender(): GameResult {
    const result: GameResult = {
      winner: this.currentPlayer === Player.Black ? Player.White : Player.Black,
      winPositions: null,
      isDraw: false,
    };
    this.gameOver = true;
    return result;
  }
  // Method to add connected players
  addPlayer(player: Player) {
    this.players.add(player);
  }

  // Method to remove disconnected players
  removePlayer(player: Player) {
    this.players.delete(player);
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getRemainingPlayer(): Player | null {
    // If there's only one player left, return that player, otherwise return null
    if (this.players.size === 1) {
      return this.players.values().next().value;
    } else {
      return null;
    }
  }

  startDisconnectTimer() {
    // Start a timer to check for disconnections
    this.disconnectTimer = setInterval(() => {
      if (this.players.size === 1) {
        // If only one player is connected, declare the other player as the winner
        this.gameOver = true;
        // Emit the game result or handle it as needed
      }
    }, this.disconnectTimeout);
  }

  stopDisconnectTimer() {
    // Stop the disconnect timer if it's running
    if (this.disconnectTimer) {
      clearInterval(this.disconnectTimer as unknown as number);
      this.disconnectTimer = null;
    }
  }
}
