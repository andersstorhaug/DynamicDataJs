import { DeviceMetadata } from './DeviceMetadata';
import { Device } from './Device';

export class DeviceWithMetadata {
    constructor(public readonly key: string, public readonly device?: Device, public readonly metadata?: DeviceMetadata) {}
}
