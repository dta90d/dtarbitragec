#!/usr/bin/env perl

# CAMParse.pm
# Written by dta90d on 2017.09.14.
#############################################################################
# PARSE DATA FROM dtarbitragec cryptocurrency-arbitrage-master (CAM)#########
#############################################################################

package CAMParse;

use Modern::Perl '2015';
use autodie;

use JSON;

use FindBin;
use DateTime;

BEGIN { unshift @INC, "$FindBin::Bin" } # For Windows.

use CAMParse::Functions;
use CAMParse::DrawChart;

# Parse one data file.
sub parse_data_file {
    
    my ($filename) = @_;
    # Open the database to read to a string.
    open(my $db, "<", $filename);

    my $text_data = readline($db);

    close($db);
    
    # Parse text string to JSON format:
    # Delete trailing comma. And edit the text to fit JSON.
    $text_data =~ s/^/[/;
    $text_data =~ s/,$//;
    $text_data =~ s/$/]/; # it is unnecessary, but it's better for an eye
    my $json_data = decode_json $text_data;
    #say $json_data; #TODO: REMOVE
    
    # Get the coin list:
    my @required_coins = get_coins($json_data);
    
    # Get the spread foreach coin
    #get_the_spread($json_data, \@required_coins);
    
    #get_max_spread($json_data, \@required_coins, $ratio);
    
    my @data = get_all_data($json_data);
    my @markets = get_markets(@data);
    #TODO:REMOVE#CAMParse::Functions::parse_spreads(\@data, 'USD_BTC');
    
    # Draw chart on spread for each coin
    for my $coin (@required_coins) {
        CAMParse::Functions::parse_spreads(\@data, $coin);
        for my $high_market (@markets) {
            for my $low_market (@markets) {
                # <if> start
                CAMParse::DrawChart::one_coin_spread(\@data, $coin,
                                                      $high_market, $low_market)
                if $high_market ne $low_market; # <if> end
            }
        }
    }
}

#say "SPREAD: ".$_->{spread}." OF COIN ".$_->{coin} for (@data);#TODO:REMOVE

# Get markets from data.
sub get_markets {
    my @data = @_;
    my @m;
    
    for (@data) {
        my ($h, $l) = ($_->{high_market}, $_->{low_market});
        push @m, $h unless grep {/$h/} @m;
        push @m, $l unless grep {/$l/} @m;
    }
    
    return @m;
}

# Copy pdf files from buffer directory to the database.
sub save_pdf_to_db {

}

#parse_data_file("./1.txt");


sub spreads_column {
    my ($file) = @_;
    
    open(my $fh, "<", $file);
    
    my $text_data = readline($fh);
    
    close($fh);
    undef $fh;
    
    $text_data =~ s/^/[/;
    $text_data =~ s/,$//;
    $text_data =~ s/$/]/;
    my $json_data = decode_json $text_data;
    
    my @data           = get_all_data($json_data);
    my $coin = 'USD_ETC';
    my @markets        = get_markets(@data);
    
    CAMParse::Functions::parse_spreads(\@data, $coin);
    
    my @spreads;
    my ($high_market, $low_market);
    for (@data) {
        next if $_->{coin} !~ /$coin/;
        $high_market = $_->{high_market};# unless $high_market;
        $low_market  = $_->{low_market}; # unless $low_market;
        my $spread = $_->{spread};
        my $time   = DateTime->from_epoch( epoch => $_->{time} )->strftime('%H:%M:%S-%d-%m-%Y');
        push @spreads, "$time $spread";
    }
    open(my $res, ">", "spreads_".$high_market."_".$low_market."_".$file.".txt");
    
    for (@spreads) {
       say $res $_;
    }
    close($res);
    undef $res;
}

sub bid_ask_column {
    my ($file) = @_;

    open(my $fh, "<", $file);

    my $text_data = readline($fh);

    close($fh);
    undef $fh;

    $text_data =~ s/^/[/;
    $text_data =~ s/,$//;
    $text_data =~ s/$/]/;
    my $json_data = decode_json $text_data;

    my @data           = get_all_data($json_data);
    my $coin = 'USD_ETC';
    my @markets        = get_markets(@data);

    CAMParse::Functions::parse_spreads(\@data, $coin);

    my @bid_ask;
    my ($high_market, $low_market);
    for (@data) {
        next if $_->{coin} !~ /$coin/;
        $high_market = $_->{high_market};# unless $high_market;
        $low_market  = $_->{low_market}; # unless $low_market;
        my $bid_high = $_->{high_market_bid};
        my $ask_high = $_->{high_market_ask};
        my $bid_low  = $_->{low_market_bid};
        my $ask_low = $_->{low_market_ask};
        my $time   = DateTime->from_epoch( epoch => $_->{time} )->strftime('%H:%M:%S-%d-%m-%Y');
        push @bid_ask, "$time|$high_market $bid_high $ask_high ### "
                            ."$low_market $bid_low $ask_low";
    }
    open(my $res, ">", "bid-ask_".$high_market."_".$low_market."_".$file.".txt");

    for (@bid_ask) {
       say $res $_;
    }
    close($res);
    undef $res;
}

spreads_column("08.09.q3");
