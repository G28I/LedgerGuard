/**
 * Type contract for resolved secrets from AWS Secrets Manager.
 */
export type ResolvedSecrets = Record<string, string>;

/**
 * Result contract returned when resolving a secret value.
 */
export interface SecretResolutionResult {
  readonly secretId: string;
  readonly values: ResolvedSecrets;
  readonly versionId?: string;
}

/**
 * Interface for AWS Secrets Manager loader.
 */
export interface ISecretsManagerLoader {
  loadSecret(secretId: string): Promise<SecretResolutionResult>;
}
