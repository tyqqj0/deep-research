// @/domains/mcts/algorithms/DefaultAlgorithmFactory.ts

import { injectable, container } from 'tsyringe';
import { 
  IAlgorithmFactory,
  IThinker,
  IFormulator,
  ICiter,
  ILocator,
  IValidator,
  IRewardCalculator
} from './interfaces';
import { DefaultThinker } from './modules/DefaultThinker';
import { DefaultFormulator } from './modules/DefaultFormulator';
import { DefaultCiter } from './modules/DefaultCiter';
import { DefaultLocator } from './modules/DefaultLocator';
import { DefaultValidator } from './modules/DefaultValidator';
import { DefaultRewardCalculator } from './modules/DefaultRewardCalculator';
import { Logger } from '../../../infrastructure/logging/Logger';

/**
 * Default implementation of the AlgorithmFactory.
 * Creates instances of the various MCTS algorithm modules.
 */
@injectable()
export class DefaultAlgorithmFactory implements IAlgorithmFactory {
  private logger = Logger.getInstance();

  constructor() {
    this.logger.info('DefaultAlgorithmFactory initialized');
  }

  createThinker(config: any): IThinker {
    // For now, we always return the default implementation
    // In a real system, we might use config to determine which implementation to use
    return container.resolve(DefaultThinker);
  }

  createFormulator(config: any): IFormulator {
    return container.resolve(DefaultFormulator);
  }

  createCiter(config: any): ICiter {
    return container.resolve(DefaultCiter);
  }

  createLocator(config: any): ILocator {
    return container.resolve(DefaultLocator);
  }

  createValidator(config: any): IValidator {
    return container.resolve(DefaultValidator);
  }

  createRewardCalculator(config: any): IRewardCalculator {
    return container.resolve(DefaultRewardCalculator);
  }
}