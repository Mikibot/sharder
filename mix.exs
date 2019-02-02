defmodule Consumer do
    use GenStage

    def init(_) do
       producers = Crux.Gateway.Connection.Producer.producers() |> Map.values()
       {:consumer, nil, subscribe_to: producers}
    end

     def handle_events(events, _from, nil) do
       for {:MESSAGE_CREATE, message, _shard_id} <- events do
         IO.puts("#{message.author.username}##{message.author.discriminator}: #{message.content}")
       end

       {:noreply, [], nil}
     end
end

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

    end

    defp deps() do
        [
            {:crux_gateway, "~> 0.1.4"},
            {:amqp_client, "~> 3.7"},
            {:redix, "~> 0.9.1"},
        ]
    end
end