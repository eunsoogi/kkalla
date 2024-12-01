export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum Permission {
  VIEW_USERS = 'view:users',
  MANAGE_USERS = 'manage:users',
  VIEW_INFERENCE_NASDAQ = 'view:inference:nasdaq',
  VIEW_INFERENCE_COIN_MAJOR = 'view:inference:coin:major',
  VIEW_INFERENCE_COIN_MINOR = 'view:inference:coin:minor',
  TRADE_NASDAQ = 'trade:nasdaq',
  TRADE_COIN_MAJOR = 'trade:coin:major',
  TRADE_COIN_MINOR = 'trade:coin:minor',
}
