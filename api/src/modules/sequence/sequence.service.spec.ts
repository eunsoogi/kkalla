import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Sequence } from './entities/sequence.entity';
import { SequenceService } from './sequence.service';

describe('SequenceService', () => {
  let service: SequenceService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs',
          entities: [Sequence],
          autoSave: false,
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([Sequence]),
      ],
      providers: [SequenceService],
    }).compile();

    service = module.get<SequenceService>(SequenceService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // 테스트 간 데이터 정리
    await Sequence.clear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate unique sequence numbers', async () => {
    const seq1 = await service.getNextSequence();
    const seq2 = await service.getNextSequence();
    const seq3 = await service.getNextSequence();

    expect(seq1).toBeDefined();
    expect(seq2).toBeDefined();
    expect(seq3).toBeDefined();
    expect(seq1).not.toBe(seq2);
    expect(seq2).not.toBe(seq3);
    expect(seq1).not.toBe(seq3);
  });

  it('should handle concurrent sequence generation with Promise.all', async () => {
    const concurrentCount = 10;
    const promises = Array.from({ length: concurrentCount }, () => service.getNextSequence());
    const sequences = await Promise.all(promises);

    // 모든 시퀀스가 정의되어야 함
    sequences.forEach((seq) => {
      expect(seq).toBeDefined();
      expect(typeof seq).toBe('number');
      expect(seq).toBeGreaterThan(0);
    });

    const uniqueSequences = new Set(sequences);

    // 직렬화로 인해 모든 시퀀스가 유니크해야 함
    expect(uniqueSequences.size).toBe(concurrentCount);
  });

  it('should handle high concurrency stress test', async () => {
    const concurrentCount = 50;
    const promises = Array.from({ length: concurrentCount }, () => service.getNextSequence());

    const sequences = await Promise.all(promises);
    const uniqueSequences = new Set(sequences);

    // 모든 시퀀스가 유효해야 함
    sequences.forEach((seq) => {
      expect(seq).not.toBeNull();
      expect(seq).not.toBeUndefined();
      expect(seq).toBeGreaterThan(0);
    });

    // 직렬화로 인해 모든 시퀀스가 유니크해야 함
    expect(uniqueSequences.size).toBe(concurrentCount);
  });

  it('should return correct current sequence', async () => {
    // 초기 상태
    const initialCurrent = await service.getCurrentSequence();
    expect(initialCurrent).toBe(0);

    // 몇 개의 시퀀스 생성
    const seq1 = await service.getNextSequence();
    const seq2 = await service.getNextSequence();
    const seq3 = await service.getNextSequence();

    // 현재 시퀀스는 가장 큰 값이어야 함
    const currentSequence = await service.getCurrentSequence();
    expect(currentSequence).toBe(Math.max(seq1, seq2, seq3));
  });

  it('should maintain consistency after concurrent operations', async () => {
    const rounds = 3;
    const concurrentPerRound = 10;
    const allSequences: number[] = [];

    for (let round = 0; round < rounds; round++) {
      const promises = Array.from({ length: concurrentPerRound }, () => service.getNextSequence());
      const sequences = await Promise.all(promises);

      allSequences.push(...sequences);

      const uniqueSequences = new Set(sequences);

      // 각 라운드별로 모든 시퀀스가 유니크해야 함
      expect(uniqueSequences.size).toBe(concurrentPerRound);
    }

    const totalSequences = await Sequence.count();

    // 전체적으로 정확히 30개의 시퀀스가 생성되어야 함
    expect(totalSequences).toBe(rounds * concurrentPerRound);
    expect(new Set(allSequences).size).toBe(rounds * concurrentPerRound);
  });
});
