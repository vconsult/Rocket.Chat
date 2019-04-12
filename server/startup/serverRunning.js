import { Meteor } from 'meteor/meteor';
import { MongoInternals } from 'meteor/mongo';
import { SystemLogger } from '../../app/logger';
import { settings } from '../../app/settings';
import { Info } from '../../app/utils';
import fs from 'fs';
import path from 'path';
import semver from 'semver';

Meteor.startup(function() {
	let oplogState = 'Disabled';

	const { mongo } = MongoInternals.defaultRemoteCollectionDriver();

	if (mongo._oplogHandle && mongo._oplogHandle.onOplogEntry) {
		oplogState = 'Enabled';
		if (settings.get('Force_Disable_OpLog_For_Cache') === true) {
			oplogState += ' (Disabled for Cache Sync)';
		}
	}

	let mongoDbVersion;
	let mongoDbEngine;
	try {
		const { version, storageEngine } = Promise.await(mongo.db.command({ serverStatus: 1 }));
		mongoDbVersion = version;
		mongoDbEngine = storageEngine.name;
	} catch (e) {
		mongoDbVersion = 'Error getting version';
		console.error('Error getting MongoDB version');
	}

	const desiredNodeVersion = semver.clean(fs.readFileSync(path.join(process.cwd(), '../../.node_version.txt')).toString());
	const desiredNodeVersionMajor = String(semver.parse(desiredNodeVersion).major);

	return Meteor.setTimeout(function() {
		let msg = [
			`Rocket.Chat Version: ${ Info.version }`,
			`     NodeJS Version: ${ process.versions.node } - ${ process.arch }`,
			`    MongoDB Version: ${ mongoDbVersion }`,
			`     MongoDB Engine: ${ mongoDbEngine }`,
			`           Platform: ${ process.platform }`,
			`       Process Port: ${ process.env.PORT }`,
			`           Site URL: ${ settings.get('Site_Url') }`,
			`   ReplicaSet OpLog: ${ oplogState }`,
		];

		if (Info.commit && Info.commit.hash) {
			msg.push(`        Commit Hash: ${ Info.commit.hash.substr(0, 10) }`);
		}

		if (Info.commit && Info.commit.branch) {
			msg.push(`      Commit Branch: ${ Info.commit.branch }`);
		}

		msg = msg.join('\n');

		if (!semver.satisfies(process.versions.node, desiredNodeVersionMajor)) {
			msg += ['', '', 'YOUR CURRENT NODEJS VERSION IS NOT SUPPORTED,', `PLEASE UPGRADE / DOWNGRADE TO VERSION ${ desiredNodeVersionMajor }.X.X`].join('\n');
			SystemLogger.error_box(msg, 'SERVER ERROR');

			return process.exit();
		}

		if (!semver.satisfies(mongoDbVersion, '>=3.2.0')) {
			msg += ['', '', 'YOUR CURRENT MONGODB VERSION IS NOT SUPPORTED,', 'PLEASE UPGRADE TO VERSION 3.2 OR LATER'].join('\n');
			SystemLogger.error_box(msg, 'SERVER ERROR');

			return process.exit();
		}

		return SystemLogger.startup_box(msg, 'SERVER RUNNING');
	}, 100);
});
