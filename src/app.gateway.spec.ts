import { Test, TestingModule } from '@nestjs/testing';
import { EventGateway } from './app.gateway';
import { GomokuGameService } from './app.service'; // Assuming you have GomokuGame class defined in gomoku.ts

describe('EventGateway', () => {
  let gateway: EventGateway;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let gomokuGame: GomokuGameService;
  let mockServer: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventGateway],
    }).compile();

    gateway = module.get<EventGateway>(EventGateway);
    gomokuGame = new GomokuGameService(); // Create a new instance of GomokuGame for each test

    // Mock the WebSocketServer instance
    mockServer = {
      emit: jest.fn(),
    };
    gateway.server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should start a new game', () => {
    gateway.handleJoinGame(null, '1');

    expect(mockServer.emit).toHaveBeenCalledWith(
      'gameState',
      expect.any(Array),
    );
  });

  it('should make a move', () => {
    const move = { x: 0, y: 0 };
    gateway.handleMakeMove(null, { roomId: '1', move });

    expect(mockServer.emit).toHaveBeenCalledWith(
      'gameState',
      expect.any(Array),
    );
  });
});
