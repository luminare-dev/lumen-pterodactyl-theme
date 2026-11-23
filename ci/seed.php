<?php
// CI only: example data for the screenshots. Run inside the panel container:
//   php /app/ci-seed.php
// Invented names and reserved example addresses only. The node points at ci/wings-mock.py.

use Ramsey\Uuid\Uuid;
use Illuminate\Support\Str;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\User;
use Pterodactyl\Models\Backup;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Schedule;
use Pterodactyl\Models\Allocation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;

require '/app/vendor/autoload.php';
$app = require '/app/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$password = getenv('SEED_PASSWORD') ?: 'lumen-ci-password';

$user = function (string $username, string $first, string $last, bool $admin) use ($password) {
    $u = User::query()->firstOrNew(['username' => $username])->forceFill([
        'uuid' => Uuid::uuid4()->toString(),
        'email' => $username . '@example.com',
        'name_first' => $first,
        'name_last' => $last,
        'password' => Hash::make($password),
        'root_admin' => $admin,
        'language' => 'en',
    ]);
    $u->saveOrFail();

    return $u;
};

$admin = $user('admin', 'Ada', 'Admin', true);
$mira = $user('mira', 'Mira', 'Example', false);
$user('jonas', 'Jonas', 'Example', false);

$location = Location::query()->firstOrCreate(['short' => 'eu-central'], ['long' => 'Example data centre, Europe']);
Location::query()->firstOrCreate(['short' => 'us-east'], ['long' => 'Example data centre, America']);

$node = Node::query()->where('name', 'node-1')->first() ?? (new Node())->forceFill([
    'uuid' => Uuid::uuid4()->toString(),
    'public' => true,
    'name' => 'node-1',
    'description' => 'Example node (a mock daemon in CI)',
    'location_id' => $location->id,
    'fqdn' => 'node-1.example.com',
    'scheme' => 'http',
    'behind_proxy' => false,
    'memory' => 32768,
    'memory_overallocate' => 0,
    'disk' => 512000,
    'disk_overallocate' => 0,
    'upload_size' => 100,
    'daemon_token_id' => Str::random(Node::DAEMON_TOKEN_ID_LENGTH),
    'daemon_token' => Crypt::encrypt(Str::random(Node::DAEMON_TOKEN_LENGTH)),
    'daemonListen' => 8443,
    'daemonSFTP' => 2022,
    'daemonBase' => '/var/lib/pterodactyl/volumes',
]);
$node->saveOrFail();

$egg = Egg::query()->where('name', 'like', '%Paper%')->first() ?? Egg::query()->orderBy('id')->firstOrFail();

$servers = [
    ['Survival world', 'Paper, whitelist on', 4096, 25565],
    ['Creative build', 'Plots for the build team', 2048, 25566],
    ['Modded SMP', 'Fabric pack, weekly resets', 8192, 25567],
    ['Lobby', 'Velocity entry point', 1024, 25568],
];
foreach ($servers as [$name, $description, $memory, $port]) {
    if (Server::query()->where('name', $name)->exists()) {
        continue;
    }
    $allocation = Allocation::query()->firstOrCreate(['node_id' => $node->id, 'ip' => '203.0.113.10', 'port' => $port]);
    $server = (new Server())->forceFill([
        'uuid' => Uuid::uuid4()->toString(),
        'uuidShort' => Str::lower(Str::random(8)),
        'node_id' => $node->id,
        'name' => $name,
        'description' => $description,
        'owner_id' => $admin->id,
        'skip_scripts' => false,
        'status' => null,
        'memory' => $memory,
        'swap' => 0,
        'disk' => 20480,
        'io' => 500,
        'cpu' => 200,
        'oom_disabled' => true,
        'allocation_id' => $allocation->id,
        'nest_id' => $egg->nest_id,
        'egg_id' => $egg->id,
        'startup' => $egg->startup ?? 'java -jar server.jar',
        'image' => array_values($egg->docker_images ?? ['ghcr.io/example/image:latest'])[0],
        'database_limit' => 2,
        'allocation_limit' => 4,
        'backup_limit' => 5,
        'installed_at' => now(),
    ]);
    $server->saveOrFail();
    $allocation->forceFill(['server_id' => $server->id])->save();
}
foreach (range(25569, 25574) as $port) {
    Allocation::query()->firstOrCreate(['node_id' => $node->id, 'ip' => '203.0.113.10', 'port' => $port]);
}

$first = Server::query()->orderBy('id')->firstOrFail();

// Extras for the server pages; each is optional, a schema difference must not stop the seed.
$try = function (string $what, callable $fn) {
    try {
        $fn();
    } catch (Throwable $e) {
        fwrite(STDERR, "seed: skipped $what: {$e->getMessage()}\n");
    }
};
$try('second allocation', function () use ($first, $node) {
    Allocation::query()->where('node_id', $node->id)->where('port', 25569)->update(['server_id' => $first->id, 'notes' => 'Voice chat']);
});
$try('backups', function () use ($first) {
    foreach ([['Before 1.21.4 update', 2_180_000_000, 3], ['Nightly', 2_150_000_000, 1]] as [$name, $bytes, $days]) {
        if (Backup::query()->where('server_id', $first->id)->where('name', $name)->exists()) {
            continue;
        }
        (new Backup())->forceFill([
            'server_id' => $first->id,
            'uuid' => Uuid::uuid4()->toString(),
            'name' => $name,
            'ignored_files' => [],
            'disk' => Backup::ADAPTER_WINGS,
            'is_successful' => true,
            'is_locked' => $days > 2,
            'checksum' => 'sha1:' . sha1($name),
            'bytes' => $bytes,
            'completed_at' => now()->subDays($days),
        ])->saveOrFail();
    }
});
$try('schedules', function () use ($first) {
    foreach ([['Nightly restart', '0', '4'], ['Hourly save', '0', '*']] as [$name, $minute, $hour]) {
        Schedule::query()->firstOrCreate(['server_id' => $first->id, 'name' => $name], [
            'cron_day_of_week' => '*', 'cron_month' => '*', 'cron_day_of_month' => '*',
            'cron_hour' => $hour, 'cron_minute' => $minute, 'is_active' => true, 'is_processing' => false,
            'only_when_online' => true, 'next_run_at' => now()->addHour(),
        ]);
    }
});
$try('subuser', function () use ($first, $mira) {
    DB::table('subusers')->updateOrInsert(
        ['user_id' => $mira->id, 'server_id' => $first->id],
        ['permissions' => json_encode(['control.console', 'control.start', 'file.read']), 'created_at' => now(), 'updated_at' => now()],
    );
});

$try('blueprint introduction', function () {
    app(\Pterodactyl\BlueprintFramework\Libraries\ExtensionLibrary\Console\BlueprintConsoleLibrary::class)
        ->dbSet('blueprint', 'flags:introduction_dismissed', true);
});

echo 'seeded: ' . User::query()->count() . ' users, ' . Server::query()->count() . " servers\n";
echo $first->uuidShort . "\n";
