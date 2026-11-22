/**
 * Re-export of the canonical runtime-agnostic logger defined in the
 * design-system package. See design-system/src/utils/logger.ts for
 * the implementation and rationale.
 */
export {
  logger,
  configureLogger,
  resetLogger,
  scrub,
  scrubString,
  LOG_LEVEL_PRIORITY,
  getEffectiveLevel,
  isProd,
  type LogMethod,
  type LogLevel,
  type LogSink,
  type LogSinkFn,
  type LogSinkObj,
  type LoggerOptions,
} from '../../design-system/src/utils/logger';
