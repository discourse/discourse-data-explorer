# frozen_string_literal: true

desc "Shows a list of hidden queries"
task 'query:list_hidden' => :environment do |t|
  hidden_queries = []
  puts "-----------------"
  puts "Hidden Queries"
  puts "-----------------"

  DataExplorer::Query.all.each do |query|
    hidden_queries.push(query) if query.hidden
  end

  hidden_queries.each do |query|
    puts "Name: #{query.name}"
    puts "Description: #{query.description}"
    puts "ID: #{query.id}"
    puts "-----------------"
  end
end

desc "Hides all queries, w/ boolean arg to hide only default ones"
task 'query:hide_all', [:only_default] => :environment do |t, args|
  only_default = args.only_default ? args.only_default.downcase == "true" : false

  DataExplorer::Query.all.each do |query|
    unless query.hidden
      if only_default && query.id < 0
        puts "-----------------"
        puts "Default query with id #{query.id}"
        query.hidden = true
        query.save
        puts "Hide default query with id #{query.id}" if query.hidden
      elsif !only_default
        puts "-----------------"
        puts "Query with id #{query.id}"
        query.hidden = true
        query.save
        puts "Hide query with id #{query.id}" if query.hidden
      end
    end
  end
  puts "-----------------"
end

desc "Unhides a query by id"
task 'query:unhide', [:id] => :environment do |t, args|
  id = args.id.to_i

  if DataExplorer.pstore_get("q:#{id}").nil?
    puts "-----------------"
    puts "Query with id #{id} does not exist"
    puts "-----------------"
  else
    q = DataExplorer::Query.find(id)
    puts "-----------------"
    if q
      puts "Found query with id #{id}"
    end

    q.hidden = false
    q.save
    puts "Unhide query with id #{id}" unless q.hidden
    puts "-----------------"
  end
end

desc "Unhides all hidden queries, w/ boolean arg to exclude default ones"
task 'query:unhide_all', [:exclude_default] => :environment do |t, args|
  exclude_default = args.exclude_default ? args.exclude_default.downcase == "true" : false

  DataExplorer::Query.all.each do |query|
    if query.hidden
      unless exclude_default && query.id < 0
        puts "-----------------"
        puts "Query with id #{query.id}"
        query.hidden = false
        query.save
        puts "Unhide query with id #{query.id}" unless query.hidden
      end
    end
  end
  puts "-----------------"
end
