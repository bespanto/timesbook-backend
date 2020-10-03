#!/bin/bash
│
# docker build -t timesbook-back .
docker build -t localhost:5000/timesbook-back .
# docker tag timesbook-back localhost:5000/timesbook-back
docker push localhost:5000/timesbook-back
