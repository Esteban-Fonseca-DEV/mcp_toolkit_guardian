// VIOLATION: ISP_FAT_INTERFACE — Interface with too many methods (8 > threshold of 5)
// Should be split into IReadRepository, IWriteRepository, IBulkRepository

export interface IRepository {
  findById(id: string): Promise<any>;
  findAll(): Promise<any[]>;
  findByFilter(filter: Record<string, any>): Promise<any[]>;
  create(data: any): Promise<any>;
  update(id: string, data: any): Promise<any>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
  exists(id: string): Promise<boolean>;
  bulkCreate(data: any[]): Promise<any[]>;
  bulkDelete(ids: string[]): Promise<void>;
}
