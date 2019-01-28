defmodule Fragment.MixProject do
    use Mix.Project

    def project() do
        [
            app: :Gateway,
            version: "0.0.1",
            elixir: "~> 1.0",
            deps: deps(),
        ] 
    end

    def application() do
        IO.puts "hello"
    end

    defp deps() do
        [
            {:crux_gateway, "~> 0.1.4"},
            {:amqp_client, "~> 3.7"},
            {:redix, "~> 0.9.1"},
        ]
    end
end