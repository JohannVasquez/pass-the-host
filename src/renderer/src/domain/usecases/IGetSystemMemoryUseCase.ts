export interface IGetSystemMemoryUseCase {
  getTotalMemoryGB(): Promise<number>;
}
