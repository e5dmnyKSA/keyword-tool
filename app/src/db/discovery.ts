import { db } from '../shared/db';
import { ObjectId } from 'mongodb';
import { IDiscovery } from '../types/IDiscovery';
import { IQueueType } from '../types/IQueueType';
import { IReportStatus } from '../types/IReportStatus';
import { IReportTask } from '../types/IReportTask';
import { IDiscoveryForList } from '../types/IDiscoveryForList';

const COLLECTION = 'discovery';

export const dbCreateDiscovery = async (report: Omit<IDiscovery, '_id'>): Promise<ObjectId | undefined> => {
  if (!db) {
    throw new Error('Database not connected');
  }

  const collection = await db.collection(COLLECTION);
  const result = await collection.insertOne(report);
  return result.insertedId;
};

export const dbListDiscovery = async (): Promise<IDiscoveryForList[]> => {
  if (!db) {
    throw new Error('Database not connected');
  }

  const collection = await db.collection(COLLECTION);
  return collection.find<IDiscoveryForList>({}, { projection: { _id: 1, status: 1, name: 1, date: 1 } }).toArray();
};

export const dbGetDiscovery = async <T>(
  id: ObjectId,
  projection?: { [P in keyof Required<T>]: 1 },
): Promise<T | undefined> => {
  if (!db) {
    throw new Error('Database not connected');
  }

  let result;
  const collection = await db.collection(COLLECTION);

  if (projection) {
    const finalProjection = { ...projection, _id: 1 };
    result = await collection.findOne<T>(
      {
        _id: id,
      },
      { projection: finalProjection },
    );
  } else {
    result = await collection.findOne<T>({
      _id: id,
    });
  }

  if (!result) {
    return undefined;
  }

  return {
    ...result,
    _id: id,
  };
};

export const dbUpdateDiscovery = async (id: ObjectId, report: Partial<Omit<IDiscovery, '_id' | 'date'>>): Promise<boolean> => {
  if (!db) {
    throw new Error('Database not connected');
  }

  const collection = await db.collection(COLLECTION);
  const result = await collection.updateOne(
    { _id: id },
    {
      $set: {
        ...report,
        updatedAt: new Date(),
      },
    },
  );
  return result.modifiedCount === 1;
};

export const dbDeleteDiscovery = async (id: ObjectId): Promise<boolean> => {
  if (!db) {
    throw new Error('Database not connected');
  }

  const collection = await db.collection(COLLECTION);
  const result = await collection.deleteOne({ _id: id });
  return result.deletedCount === 1;
};

export const dbAddOrUpdateDiscoveryTask = async (
  _id: ObjectId,
  taskUuid: string,
  queueType: IQueueType,
  status: IReportStatus,
): Promise<boolean> => {
  if (!db) {
    throw new Error('Database not connected');
  }

  const collection = await db.collection(COLLECTION);
  const report = await dbGetDiscovery<Pick<IDiscovery, '_id' | 'tasks'>>(_id, { _id: 1, tasks: 1 });

  if (!report) {
    throw new Error(`Report with id ${_id} not found for updating task`);
  }

  let result;
  const found = report.tasks.find((task) => task.uuid === taskUuid);

  if (found) {
    result = await collection.updateOne({ _id: _id, 'tasks.uuid': taskUuid }, { $set: { 'tasks.$.status': status } });
  } else {
    const newTask: IReportTask = {
      status,
      uuid: taskUuid,
      type: queueType,
      startDate: new Date(),
    };
    result = await collection.updateOne({ _id: _id }, { $addToSet: { tasks: newTask } });
  }

  return result.modifiedCount === 1;
};
