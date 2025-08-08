// src-refactored/infrastructure/di/container.ts
import { container } from 'tsyringe';

import { ILiteratureRepository } from '@/domains/literature/repositories/ILiteratureRepository';
import { DexieLiteratureRepository } from '../database/repositories/DexieLiteratureRepository';
import { ILibraryService } from '@/domains/literature/services/ILibraryService';
import { LibraryService } from '@/domains/literature/services/LibraryService';
import { IMatchingEngine } from '@/domains/literature/services/IMatchingEngine';
import { MatchingEngine } from '@/domains/literature/services/MatchingEngine';
import { ICitationLinker } from '@/domains/literature/services/ICitationLinker';
import { CitationLinker } from '@/domains/literature/services/CitationLinker';
import { SimilarityCalculator } from '@/domains/literature/services/SimilarityCalculator';
import { ReferenceExtractor } from '@/domains/literature/services/ReferenceExtractor';

// Tree domain imports
import { ITreeRepository } from '@/domains/tree/repositories/ITreeRepository';
import { DexieTreeRepository } from '../database/repositories/DexieTreeRepository';
import { ITreeService } from '@/domains/tree/services/ITreeService';
import { TreeService } from '@/domains/tree/services/TreeService';

// Register Literature domain services
container.register(ILiteratureRepository, { useClass: DexieLiteratureRepository });
container.register(ILibraryService, { useClass: LibraryService });
container.register(IMatchingEngine, { useClass: MatchingEngine });
container.register(ICitationLinker, { useClass: CitationLinker });

// Register services that don't have interfaces but are dependencies
container.register(SimilarityCalculator, { useClass: SimilarityCalculator });
container.register(ReferenceExtractor, { useClass: ReferenceExtractor });

// Register Tree domain services
container.register(ITreeRepository, { useClass: DexieTreeRepository });
container.register(ITreeService, { useClass: TreeService });

// Workspace domain imports
import { IWorkspaceRepository } from '@/domains/workspace/repositories/IWorkspaceRepository';
import { DexieWorkspaceRepository } from '../database/repositories/DexieWorkspaceRepository';
import { IWorkspaceService } from '@/domains/workspace/services/IWorkspaceService';
import { WorkspaceService } from '@/domains/workspace/services/WorkspaceService';

// Register Workspace domain services
container.register(IWorkspaceRepository, { useClass: DexieWorkspaceRepository });
container.register(IWorkspaceService, { useClass: WorkspaceService });

// MCTS domain imports
import { SGMCTSController } from '@/domains/mcts/controller/SGMCTSController';
import { IMctsService } from '@/domains/mcts/services/IMctsService';
import { MctsService } from '@/domains/mcts/services/MctsService';
import { 
  IThinker, 
  IFormulator,
  ICiter,
  ILocator,
  IValidator,
  IRewardCalculator,
  IAlgorithmFactory
} from '@/domains/mcts/algorithms/interfaces';
import { DefaultThinker } from '@/domains/mcts/algorithms/modules/DefaultThinker';
import { DefaultFormulator } from '@/domains/mcts/algorithms/modules/DefaultFormulator';
import { DefaultCiter } from '@/domains/mcts/algorithms/modules/DefaultCiter';
import { DefaultLocator } from '@/domains/mcts/algorithms/modules/DefaultLocator';
import { DefaultValidator } from '@/domains/mcts/algorithms/modules/DefaultValidator';
import { DefaultRewardCalculator } from '@/domains/mcts/algorithms/modules/DefaultRewardCalculator';
import { DefaultAlgorithmFactory } from '@/domains/mcts/algorithms/DefaultAlgorithmFactory';

// Register MCTS domain services
// Core controller and service
container.register(SGMCTSController, { useClass: SGMCTSController });
container.register(IMctsService, { useClass: MctsService });

// Algorithm module implementations
container.register('IThinker', { useClass: DefaultThinker });
container.register('IFormulator', { useClass: DefaultFormulator });
container.register('ICiter', { useClass: DefaultCiter });
container.register('ILocator', { useClass: DefaultLocator });
container.register('IValidator', { useClass: DefaultValidator });
container.register('IRewardCalculator', { useClass: DefaultRewardCalculator });
container.register(IAlgorithmFactory, { useClass: DefaultAlgorithmFactory });

export default container;

