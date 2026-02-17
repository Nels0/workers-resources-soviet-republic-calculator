.PHONY: backend frontend import dev

backend:
	cd backend && uv run flask --app app run

frontend:
	cd frontend && npm run dev

dev:
	@trap 'kill 0' EXIT; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

import:
	cd backend && uv run python -m extractor.importer $(ARGS)

reimport:
	cd backend && uv run python -m extractor.importer --game-dir /run/media/nelson/Storage/SteamLibrary/steamapps/common/SovietRepublic/
