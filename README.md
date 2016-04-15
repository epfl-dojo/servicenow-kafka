# README

# Objectifs

Process #1

1. connect to Service Now
2. pull ticket
3. feed them to kafka

Process #2

1. tail tickets from kafka: 
  docker exec -it kafka_kafka_1 /bin/bash
  cd /opt/kafka_*/bin
  ./kafka-console-consumer.sh --zookeeper zookeeper_1 --topic servicenow-tickets


https://it.epfl.ch/backoffice/api/now/v1/table/incident?sysparm_limit=10&sysparm_query=active=true^ORDERBYnumber^ORDERBYDESCcategory
