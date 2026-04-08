You should run the command after you have deployed the new code and started the containers with docker-compose up.

Here is the exact order for your production server:

Deploy code: Pull the new changes (including the alembic folder and start.sh) to your server.
Build & Start: Run docker-compose up -d --build.
Note: The backend might show an error in the logs initially because it tries to "create" tables that already exist.
Stamp Database: Run the command to tell Alembic that your current database is already at the "initial" state:
Restart (Optional): Restart the backend container to ensure the automatic migration check passes cleanly:
Why this order?
Alembic needs to be able to talk to your live database to "stamp" it. Since the database and the Alembic tool are inside the Docker containers, those containers must be running first.

Pro-tip for your next migration:
For any future changes you make to models.py:

Generate the migration locally: alembic revision --autogenerate -m "added_new_field"
Commit the new file in versions to Git.
Pull on production and run docker-compose up -d.
The start.sh script will now automatically apply the new change because the database was already "stamped" with the previous version!