import { Global, Module } from '@nestjs/common';

import { DATABASE } from '../../common/database/database.port';
import { DatabaseService } from './database.service';

@Global()
@Module({
  providers: [
    DatabaseService,
    {
      provide: DATABASE,
      inject: [DatabaseService],
      useFactory: (database: DatabaseService) => database.db,
    },
  ],
  exports: [DatabaseService, DATABASE],
})
export class DatabaseModule {}
