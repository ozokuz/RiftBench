var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("db")
    .WithDataVolume()
    .AddDatabase("appdata");

var api = builder.AddProject<Projects.RiftBench_API>("api")
    .WithReference(postgres)
    .WaitFor(postgres)
    .WithExternalHttpEndpoints();

builder.AddViteApp("web", "../web")
    .WithPnpm(false)
    .WithReference(api)
    .WaitFor(api);

builder.Build().Run();
