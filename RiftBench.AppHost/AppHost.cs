var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("db")
    .WithDataVolume()
    .AddDatabase("appdata");

var api = builder.AddProject<Projects.RiftBench_API>("api")
    .WithReference(postgres)
    .WaitFor(postgres)
    .WithExternalHttpEndpoints();

builder.AddJavaScriptApp("web", "../web")
    .WithHttpEndpoint(port: 3000, env: "PORT")
    .WithPnpm(false)
    .WithReference(api)
    .WaitFor(api);

builder.Build().Run();
